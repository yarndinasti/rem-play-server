import chalk from "chalk"
import axios from "axios"
import "dotenv/config"

export default async (status, liver = null, content = null) => {
  let sendMessage = {}
  if (liver !== null) {
    const title =
      status == "upcoming"
        ? `${liver.name} sedang menunggu kalian loh! ${liver.emoji}`
        : status == "live"
        ? `${liver.name} sedang live! ${liver.emoji}`
        : `${liver.name} mengunggah video baru! ${liver.emoji}`
    sendMessage = {
      to:
        liver.slug !== "rem"
          ? `/topics/${liver.slug}_${status}`
          : process.env.TOKEN_APP,
      collapse_key: "type_a",
      notification: {
        title,
        body: content.title,
      },
      data: {
        url: `https://www.youtube.com/watch?v=${content.id}`,
      },
    }
  } else {
  }
  axios
    .post("https://fcm.googleapis.com/fcm/send", sendMessage, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${process.env.FCM_KEY}`,
      },
    })
    .then((res) => {
      console.log(chalk.bgBlue.white.bold(" Notifikasi berhasil dikirim "))
    })
    .catch((err) => {
      console.log(chalk.bgRed.white.bold(" Notifikasi gagal dikirim "))
      console.log(err)
    })
}
