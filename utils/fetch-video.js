import rss from "rss-converter"
import checkNotification from "./check-notification.js"
import chalk from "chalk"
import moment from "moment"

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { google } from "googleapis"
import { token_api } from "./get-yt-api.js"

const youtube = google.youtube({
  version: "v3",
  auth: await token_api,
})

const __filename = fileURLToPath(import.meta.url)
const __rootname = path.dirname(__filename) + "/../"

export default async () => {
  // find folder liver when exist
  if (!fs.existsSync(path.join(__rootname, "members"))) {
    console.log(chalk.blue(" Creating folder members... "))
    fs.mkdirSync(path.join(__rootname, "members"))
  }

  console.log(
    chalk.yellow.inverse.bold(` ${new Date().toLocaleString()} `) +
      chalk.blue.inverse.bold(" Get data... ")
  )
  await fetchVideoData()

  setInterval(async () => {
    console.log(
      chalk.yellow.inverse.bold(` ${new Date().toLocaleString()} `) +
        chalk.blue.inverse.bold(" Refresh data... ")
    )
    fetchVideoData(true)
  }, 1000 * 60)
}

async function fetchVideoData(notif = false) {
  const file_config = path.join(__rootname, "config.json")
  if (!fs.existsSync(file_config)) {
    console.log(chalk.red.bold.inverse(" 😥 Config file not found! "))
    process.exit(1)
  }

  // parse config file and get liver
  const config = JSON.parse(fs.readFileSync(file_config))
  const members = config.members

  // check members
  if (!members || members.length < 1) {
    console.log(chalk.red.bold.inverse("😥 No liver here!"))
    process.exit(1)
  }

  // fetch member
  for (const member of members) {
    const live_data = path.join(__rootname, "members", `${member.slug}.json`)

    const videos = await rss
      .toJson(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${member.id}`
      )
      .then((data) => data.items.map((item) => item.yt_videoId))
      .catch((err) => {
        console.log(
          chalk.red.bold.inverse(` 😥 Data cannot connected ${err.errno} `)
        )
        process.exit(1)
      })

    console.log(
      chalk.blue.bold(` Check video for ${member.slug} ${member.emoji} ... `)
    )

    let new_videos = fs.existsSync(live_data)
      ? JSON.parse(fs.readFileSync(live_data))
      : []

    for (const video of new_videos) {
      const past_upcoming =
        moment(video.live?.start_stream).isBefore(new Date().getTime()) &&
        video.live_status === "upcoming"

      const is_live = video.live_status === "live"
      const checking = moment(video.checked + 1000 * 60 * 60 * 24).isBefore(
        new Date().getTime()
      )

      if (!past_upcoming && !is_live && !checking) continue
      const video_data = await fetchVideo(video.id, member.slug)

      if (!video_data) new_videos = new_videos.filter((v) => v.id !== video.id)

      if (
        video.live_status === "upcoming" &&
        video_data.live_status === "live"
      ) {
        console.log(chalk.red.bold.inverse(` 🔴 Now live! `) + video_data.title)
        checkNotification(video_data.live_status, member.slug, video_data)
      } else if (
        video.live_status === "live" &&
        video_data.live_status === "none"
      ) {
        console.log(chalk.red.bold.inverse(` 🛑 Live End `) + video_data.title)
      }

      new_videos = new_videos.map((v) => {
        if (v.id === video_data.id) {
          return video_data
        }
        return v
      })
    }

    for (const video of videos) {
      const data = new_videos.find((data) => data.id === video)

      if (data) continue
      const video_data = await fetchVideo(video, member.slug)

      switch (video_data.live_status) {
        case "upcoming":
          const time_remain = moment(video_data.live.start_time).toNow()
          console.log(
            chalk.blue.inverse.bold(` 🎬 Staring in ${time_remain} `) +
              video_data.title
          )
          checkNotification(video_data.live_status, member.slug, video_data)
          break
        case "live":
          console.log(
            chalk.red.bold.inverse(` 🔴 Now live! `) + video_data.title
          )
          checkNotification(video_data.live_status, member.slug, video_data)
          break
        default:
          console.log(
            chalk.green.inverse.bold(` 📺 New video! `) + video_data.title
          )
          if (notif)
            checkNotification(video_data.live_status, member.slug, video_data)
          break
      }
      new_videos.push(video_data)
    }

    new_videos.sort((a, b) => {
      if (a.live?.start_stream && b.live?.start_stream) {
        return b.live.start_stream - a.live.start_stream
      } else if (a.live?.start_stream) {
        return -1
      } else if (b.live?.start_stream) {
        return 1
      } else {
        return b.published - a.published
      }
    })

    new_videos.splice(25)

    fs.writeFileSync(live_data, JSON.stringify(new_videos))
  }
}

async function fetchVideo(video_id, slug) {
  const video = await youtube.videos
    .list({
      id: video_id,
      part: "statistics,snippet,liveStreamingDetails,contentDetails",
      fields:
        "items(snippet(publishedAt,title,channelTitle,liveBroadcastContent),liveStreamingDetails(scheduledStartTime,actualStartTime,actualEndTime),statistics(viewCount),contentDetails(duration))",
    })
    .then((data) => data.data.items[0])
    .catch((err) => null)

  if (!video) return null

  const published = new Date(video.snippet.publishedAt).getTime()
  const duration = convertToSeconds(video.contentDetails.duration)

  const checked = new Date().getTime()

  const live = video.liveStreamingDetails
    ? {
        live: {
          start_stream: new Date(
            video.liveStreamingDetails.actualStartTime
              ? video.liveStreamingDetails.actualStartTime
              : video.liveStreamingDetails.scheduledStartTime
          ).getTime(),
          end_stream: video.liveStreamingDetails.actualEndTime
            ? new Date(video.liveStreamingDetails.actualEndTime).getTime()
            : undefined,
        },
      }
    : {}

  return {
    id: video_id,
    title: video.snippet.title,
    published,
    from: slug,
    duration,
    checked,
    live_status: video.snippet.liveBroadcastContent,
    thumbnail: {
      normal: `https://i.ytimg.com/vi/${video_id}/hqdefault.jpg`,
      mini: `https://i.ytimg.com/vi/${video_id}/default.jpg`,
    },
    ...live,
  }
}

function convertToSeconds(time) {
  const reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
  const matches = reptms.exec(time)

  let totalseconds
  if (matches === null) totalseconds = 0
  else {
    const hours = parseInt(matches[1] ?? 0)
    const minutes = parseInt(matches[2] ?? 0)
    const seconds = parseInt(matches[3] ?? 0)
    totalseconds = hours * 3600 + minutes * 60 + seconds
  }

  return totalseconds
}
