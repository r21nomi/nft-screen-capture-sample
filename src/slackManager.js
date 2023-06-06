import fetch from "node-fetch"

export const slackManager = {
  postMessageToSlack: (text) => {
    const channel = `${process.env.SLACK_CHANNEL}`
    const name = "NEORT"
    const json = {
      channel: channel,
      username: name,
      text: `【${process.env.APP_ENV}】\n${text}`
    }

    return fetch(`${process.env.SLACK_WEBHOOK_URL}`,  {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(json)
    })
  }
}