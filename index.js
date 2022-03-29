import chalk from "chalk"
import server from "./src/index.js"
import fetchVideo from "./utils/fetch-video.js"

console.log("\x1Bc")
console.log(chalk.green.bold.inverse(" Starting API... "))

await fetchVideo()
server()
