import AWS from 'aws-sdk'
import { imageUploader } from "./imageUploader.js"
import { slackManager } from "./slackManager.js"

export const sqsManager = {
  getQueueUrl: () => {
    return `${process.env.AWS_SQS_QUEUE_URL}`
  },
  getSQS: () => {
    return new AWS.SQS({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID_1,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_1,
      region: process.env.AWS_SQS_REGION
    })
  },
  sendMessage: async (tokenId) => {
    console.log(`sendMessage ${tokenId}...`)

    const params = {
      MessageAttributes: {
        "tokenId": {
          DataType: "Number",
          StringValue: `${tokenId.toString()}`
        }
      },
      MessageBody: "token id for thumbnail generation.",
      QueueUrl: sqsManager.getQueueUrl()
    }

    const sqs = sqsManager.getSQS()

    return await sqs.sendMessage(params).promise()
  },
  observeMessage: async () => {
    while(true) {
      try {
        console.log('waiting for message...')

        const sqs = sqsManager.getSQS()
        const data = await sqs.receiveMessage({
          QueueUrl: sqsManager.getQueueUrl(),
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
          MessageAttributeNames: [
            "All"
          ],
        }).promise()

        if (!data.Messages) {
          console.log('no message.')
          continue
        }

        console.log(data)

        if (data.Messages && data.Messages[0].MessageAttributes.tokenId) {
          const tokenId = data.Messages[0].MessageAttributes.tokenId.StringValue
          console.log(`*************** Generating thumbnail: ${tokenId} ***************`)

          const receiptHandle = data.Messages[0].ReceiptHandle

          try {
            const imageUrl = await imageUploader.upload(tokenId)
            if (imageUrl) {
              // Delete message from Queue
              const deleteParams = {
                QueueUrl: sqsManager.getQueueUrl(),
                ReceiptHandle: receiptHandle
              }
              sqs.deleteMessage(deleteParams, (err, data) => {
                if (err) {
                  console.log("Delete Error", err)
                } else {
                  console.log("Message Deleted", data)
                }
              })

              // Post to slack
              const text = `tokenId: ${tokenId}\n${imageUrl}`
              slackManager.postMessageToSlack(text)
                .then(data => {
                  console.log('message was posted to slack.')
                })
                .catch(error => {
                  console.log(error)
                })
            } else {
              // error
              const text = `!!!!!!!!!!!!!! Failed to generate !!!!!!!!!!!!!!\ntokenId: ${tokenId}`
              slackManager.postMessageToSlack(text)
                .then(data => {
                  console.log('message was posted to slack.')
                })
                .catch(error => {
                  console.log(error)
                })
            }
          } catch (error) {
            console.log(error)

            const text = `!!!!!!!!!!!!!! Failed to generate image !!!!!!!!!!!!!!\ntokenId: ${tokenId}`
            slackManager.postMessageToSlack(text)
              .then(data => {
                console.log('message was posted to slack.')
              })
              .catch(error => {
                console.log(error)
              })
          }
        }
      } catch (e) {
        console.log('error: ', e)
      }
    }
  },
}