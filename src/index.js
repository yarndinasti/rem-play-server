import chalk from "chalk"
import express from "express"

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __rootname = path.dirname(__filename) + "/../"

const app = express()

const server = () => {
  app.use(express.json())

  app.get("/liver", (req, res) => {
    // get all json file in liver folder

    const liver_folder = path.join(__rootname, "liver")
    const config = JSON.parse(
      fs.readFileSync(path.join(__rootname, "config.json"))
    )
    const files = fs.readdirSync(liver_folder)

    const livers = files
      .map((file) => {
        const videos = JSON.parse(
          fs.readFileSync(path.join(liver_folder, file))
        )

        for (const video of videos) {
          video.liver = config.liver.find(
            (liver) => liver.slug === file.replace(".json", "")
          )
        }

        return videos
      })
      .reduce((acc, cur) => [...acc, ...cur], [])

    // sorting livers for latest video (lagest published)
    livers.sort((a, b) => b.published - a.published)

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

  app.listen(3001, () => {
    console.log(chalk.green("Server is running on port 3001"))
  })
}

export default server
