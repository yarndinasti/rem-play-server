import chalk from "chalk"
import express from "express"

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import "dotenv/config"

const __filename = fileURLToPath(import.meta.url)
const __rootname = path.dirname(__filename) + "/../"

const app = express()

const server = () => {
  app.use(express.json())

  app.get("/", (req, res) => {
    res.send("Hello World!")
  })

  app.get("/on-app", (req, res) => {
    const liver_folder = path.join(__rootname, "members")
    const config = JSON.parse(
      fs.readFileSync(path.join(__rootname, "config.json"))
    )
    const files = fs.readdirSync(liver_folder)

    const videos = files
      .map((file) => {
        const file_path = path.join(liver_folder, file)
        const file_data = JSON.parse(fs.readFileSync(file_path))

        file_data.map((video) => {
          video.from = config.members.find((m) => m.slug === video.from)

          video.from = {
            name: video.from.name,
            slug: video.from.slug,
            channel_id: video.from.id,
          }

          return video
        })

        return file_data
      })
      .reduce((acc, cur) => [...acc, ...cur], [])

    videos.sort((a, b) => {
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

    // sort video when a.live_status == "live"
    videos.sort((a, b) => {
      if (a.live_status === "live" && b.live_status !== "live") return -1
      else if (a.live_status !== "live" && b.live_status === "live") return 1

      return 0
    })

    videos.splice(25)

    const slideshow = config.members
      .map((member) => member.slug + ".json")
      .map((file) => {
        const file_path = path.join(liver_folder, file)
        const file_data = JSON.parse(fs.readFileSync(file_path))
        const member = config.members.find(
          (m) => m.slug === file.replace(".json", "")
        )

        return {
          title:
            (member.emoji === "" ? "" : `${member.emoji} `) +
            file_data[0].title,
          url: `https://www.youtube.com/watch?v=${file_data[0].id}`,
          thumbnail: file_data[0].thumbnail.normal,
        }
      })

    res.status(200).json({
      slideshow,
      videos,
    })
  })

  app.get("/liver", (req, res) => {
    const liver_folder = path.join(__rootname, "members")
    const config = JSON.parse(
      fs.readFileSync(path.join(__rootname, "config.json"))
    )
    const files = fs.readdirSync(liver_folder)

    const videos = files
      .map((file) => {
        const file_path = path.join(liver_folder, file)
        const file_data = JSON.parse(fs.readFileSync(file_path))

        file_data.map(
          (video) =>
            (video.from = config.members
              .find((m) => m.slug === video.from)
              .map((m) => {
                return {
                  name: m.name,
                  slug: m.slug,
                  channel_id: m.id,
                }
              }))
        )
        return file_data
      })
      .reduce((acc, cur) => [...acc, ...cur], [])

    videos.sort((a, b) => {
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

    videos.splice(25)

    res.status(200).json(videos)
  })

  app.get("/liver/:slug", (req, res) => {
    const member = path.join(__rootname, "members", `${req.params.slug}.json`)
    const config = JSON.parse(
      fs.readFileSync(path.join(__rootname, "config.json"))
    )

    if (!fs.existsSync(member)) {
      res.status(404).json({
        message: "Liver not found",
      })
      return
    }

    const member_profile = config.members.find(
      (m) => m.slug === req.params.slug
    )

    const videos = JSON.parse(fs.readFileSync(member)).map((v) => {
      delete v.checked
      delete v.from
      return v
    })

    res.status(200).json({
      ...member_profile,
      videos,
    })
  })

  app.listen(process.env.PORT, () => {
    console.log(chalk.green(`Server is running on port ${process.env.PORT}`))
  })
}

export default server
