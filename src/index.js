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
    const liver_folder = path.join(__rootname, "liver")
    const config = JSON.parse(
      fs.readFileSync(path.join(__rootname, "config.json"))
    )
    const files = fs.readdirSync(liver_folder)

    const livers = files
      .map((file) => {
        let videos = JSON.parse(fs.readFileSync(path.join(liver_folder, file)))

        videos = videos.map((video) => {
          const member = config.liver.find(
            (liver) => liver.slug === file.replace(".json", "")
          )

          return {
            id: video.id,
            title: video.title,
            published: video.published,
            thumbnail: video.thumbnail,
            live: video.live,
            member: {
              slug: member.slug,
              name: member.name,
              gen: member.gen,
            },
          }
        })

        return videos
      })
      .reduce((acc, cur) => [...acc, ...cur], [])

    // sorting livers for latest video (lagest live?.start_time first when exist, but don't have live?.start_time, sort by published)
    livers.sort((a, b) => {
      if (a.live?.start_time && b.live?.start_time) {
        return b.live.start_time - a.live.start_time
      } else if (a.live?.start_time) {
        return -1
      } else if (b.live?.start_time) {
        return 1
      } else {
        return b.published - a.published
      }
    })

    // limit livers to 20 video
    livers.splice(25)

    const tab = config.liver.map((liver) => {
      let videos = JSON.parse(
        fs.readFileSync(path.join(liver_folder, liver.slug + ".json"))
      )[0]

      return {
        thumbnail: videos.thumbnail,
        title: `${liver.emoji == "" ? "" : `${liver.emoji} `}` + videos.title,
        url: `https://www.youtube.com/watch?v=${videos.id}`,
      }
    })

    const result = {
      tab,
      list: livers,
    }

    res.status(200).json(result)
  })

  app.get("/liver", (req, res) => {
    // get all json file in liver folder

    const liver_folder = path.join(__rootname, "liver")
    const config = JSON.parse(
      fs.readFileSync(path.join(__rootname, "config.json"))
    )
    const files = fs.readdirSync(liver_folder)

    const livers = files
      .map((file) => {
        let videos = JSON.parse(fs.readFileSync(path.join(liver_folder, file)))

        videos = videos.map((video) => {
          const member = config.liver.find(
            (liver) => liver.slug === file.replace(".json", "")
          )

          return {
            id: video.id,
            title: video.title,
            published: video.published,
            thumbnail: video.thumbnail,
            live: video.live,
            member: {
              slug: member.slug,
              name: member.name,
              gen: member.gen,
            },
          }
        })

        return videos
      })
      .reduce((acc, cur) => [...acc, ...cur], [])

    // sorting livers for latest video (lagest published)
    livers.sort((a, b) => {
      if (a.live?.start_time && b.live?.start_time) {
        return b.live.start_time - a.live.start_time
      } else if (a.live?.start_time) {
        return -1
      } else if (b.live?.start_time) {
        return 1
      } else {
        return b.published - a.published
      }
    })

    // limit livers to 20 video
    livers.splice(25)

    res.status(200).json(livers)
  })

  app.get("/liver/:slug", (req, res) => {
    const liver = path.join(__rootname, "liver", `${req.params.slug}.json`)
    const config = JSON.parse(
      fs.readFileSync(path.join(__rootname, "config.json"))
    )

    if (!fs.existsSync(liver)) {
      res.status(404).json({
        message: "Liver not found",
      })
      return
    }

    const liver_profile = config.liver.find(
      (liver) => liver.slug === req.params.slug
    )

    const videos = JSON.parse(fs.readFileSync(liver))

    res.status(200).json({
      ...liver_profile,
      videos,
    })
  })

  app.listen(process.env.PORT, () => {
    console.log(chalk.green("Server is running on port 3001"))
  })
}

export default server
