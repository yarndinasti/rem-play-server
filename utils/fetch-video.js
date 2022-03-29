import rss from "rss-converter"
import chalk from "chalk"

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
  if (!fs.existsSync(path.join(__rootname, "liver"))) {
    console.log(chalk.blue(" Creating folder liver... "))
    fs.mkdirSync(path.join(__rootname, "liver"))
  }

  console.log(chalk.blue.inverse.bold(" Get data... "))
  await fetchVideoData()

  setInterval(async () => {
    console.log(chalk.blue.inverse.bold(" Refresh data... "))
    fetchVideoData()
  }, 1000 * 60)
}

async function fetchVideoData() {
  // check config.json
  const file_config = path.join(__rootname, "config.json")

  if (!fs.existsSync(file_config)) {
    console.log(chalk.red.bold.inverse(" 😥 Config file not found! "))
    process.exit(1)
  }

  const config = JSON.parse(fs.readFileSync(file_config))
  const livers = config.liver

  // check livers

  if (!livers || livers.length < 1) {
    console.log(chalk.red.bold.inverse("😥 No liver here!"))
    process.exit(1)
  }

  // loop  livers using for.. of
  for (const liver of livers) {
    let feed
    try {
      feed = await rss.toJson(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${liver.id}`
      )
    } catch (error) {
      console.log(
        chalk.red.bold.inverse(` 😥 Data cannot connected ${error.errno} `)
      )
      process.exit(1)
    }

    feed = feed.items.map((item) => {
      // Convert 2021-12-14T16:41:53+00:00 format to unix time
      const unix_time = new Date(item.published).getTime()

      return {
        title: item.title,
        id: item.yt_videoId,
        published: unix_time,
      }
    })

    const liver_db = path.join(__rootname, `liver/${liver.slug}.json`)

    // find json inside liver folder
    if (!fs.existsSync(liver_db)) {
      console.log(
        chalk.bgBlue(` Creating ${chalk.white.bold(liver.slug + ".json")} `)
      )
      fs.writeFileSync(liver_db, `[]`)
    }

    // get json from liver folder
    const db = JSON.parse(fs.readFileSync(liver_db))

    for (const item of feed) {
      const videoInDB = !!db.find((video) => video.id === item.id)
      const upcomingPast =
        item.live?.live_status === "upcoming" &&
        new Date().getTime() > item.live.start_time
      const isLive = item.live?.live_status === "live"

      if (videoInDB && !upcomingPast && !isLive) continue

      const data_video = await youtube.videos.list({
        id: item.id,
        part: "statistics,snippet,liveStreamingDetails,contentDetails",
        fields:
          "items(snippet(publishedAt,title,description,thumbnails(standard),channelTitle,liveBroadcastContent),liveStreamingDetails(scheduledStartTime,concurrentViewers,actualEndTime),statistics(viewCount),contentDetails(duration))",
      })

      // check is live
      const live_status =
        data_video.data.items[0].snippet.liveBroadcastContent !== "none"
          ? data_video.data.items[0].snippet.liveBroadcastContent
          : "past"

      // when liveStreamingDetails, add object live
      const live = data_video.data.items[0].liveStreamingDetails
        ? {
            live: {
              live_status,
              start_time: new Date(
                data_video.data.items[0].liveStreamingDetails.scheduledStartTime
              ).getTime(),
            },
          }
        : {}

      const reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
      const matches = reptms.exec(
        data_video.data.items[0].contentDetails.duration
      )
      const hours = parseInt(matches[1]) || 0
      const minutes = parseInt(matches[2]) || 0
      const seconds = parseInt(matches[3]) || 0
      const totalseconds = hours * 3600 + minutes * 60 + seconds

      const thumbnail = data_video.data.items[0].snippet.thumbnails.standard
        ? data_video.data.items[0].snippet.thumbnails.standard.url
        : `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`

      if (!videoInDB) {
        db.push({
          id: item.id,
          title: item.title,
          published: item.published,
          thumbnail,
          duration: totalseconds,
          ...live,
        })

        console.log(
          chalk.bgBlue.white.bold(` New video ${liver.emoji} `) +
            " " +
            chalk.green(item.title)
        )
      } else {
        db = db.map((video) => {
          if (video.id === item.id) {
            // Check if video is live
            if (upcomingPast) {
              console.log(
                chalk.bgRed.white.bold(` Is Live! ${liver.emoji} `) +
                  " " +
                  chalk.green(item.title)
              )
            } else if (isLive) {
              console.log(
                chalk.bgBlue.white.bold(` Live End ${liver.emoji} `) +
                  " " +
                  chalk.green(item.title)
              )
            }
            return {
              id: item.id,
              title: item.title,
              published: item.published,
              thumbnail,
              duration: totalseconds,
              ...live,
            }
          }
          return video
        })
      }
    }

    // sorting db for latest video (lagest published)
    db.sort((a, b) => b.published - a.published)

    // limit db to 20 video
    db.splice(20)

    // write db to json
    fs.writeFileSync(liver_db, JSON.stringify(db))
  }
}
