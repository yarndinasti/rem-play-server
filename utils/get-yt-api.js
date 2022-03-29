import { google } from "googleapis"
import chalk from "chalk"

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __rootname = path.dirname(__filename) + "/../"

if (!fs.existsSync(path.join(__rootname, "config.json"))) {
  console.log(chalk.red.bold.inverse(" 😥 Config file not found! "))
  process.exit(1)
}

const config = JSON.parse(fs.readFileSync(path.join(__rootname, "config.json")))

const token_api = config.token_api.find(async (token) => {
  const youtube = google.youtube({
    version: "v3",
    auth: token,
  })

  // get video
  const check_token = await youtube.videos.list({
    id: "iNRrOsEHKyo",
    part: "snippet",
  })

  // check token not return error
  if (check_token.data.items) return token
})

if (!token_api) {
  console.log(chalk.red.bold.inverse(" 😥 All Token invalid! "))
  process.exit(1)
}

export { token_api }
