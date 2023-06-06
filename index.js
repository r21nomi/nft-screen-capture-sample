import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { imageUploader } from "./src/imageUploader.js"
import { sqsManager } from "./src/sqsManager.js"
import { slackManager } from "./src/slackManager.js"
import { ABI } from './src/abi.js'
import { Contract, ethers } from 'ethers'

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const port = process.env.PORT || 9002
app.listen(port, () => {
  console.log(`Listening on port ${port}...`)
})

app.get('/', (_req, res) => {
  console.log('hello.')
  res.send('HELLO.')
})

app.get('/thumbnail/:tokenId', async (req, res, next) => {
  let tokenId = req.params.tokenId
  if (tokenId.includes(".json")) {
    tokenId = tokenId.replace(".json", "")
  }
  tokenId = parseInt(tokenId)
  if (tokenId < 0) {
    next("not found")
    return
  }
  const result = await uploadImage(tokenId)
  let data = {}
  if (result.imageUrl) {
    data = {
      url: result.imageUrl
    }
  }

  const jsonStr = JSON.stringify(data, null, 2)
  res.setHeader('Content-Type', 'application/json')
  res.send(jsonStr)
})

const getContract = () => {
  return new Contract(process.env.CONTRACT_ADDRESS, ABI, provider)
}

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_NODE_URL
)

const uploadImage = async (tokenId) => {
  let imageUrl = ""
  try {
    imageUrl = await imageUploader.upload(tokenId)
    console.log(`uploaded!, tokenId: ${tokenId}, ${imageUrl}`)
  } catch (error) {
    console.log(error)
  }
  return {
    imageUrl
  }
}

const observeMint = () => {
  const contract = getContract()
  const filter = contract.filters.Transfer(
    // Mint
    '0x0000000000000000000000000000000000000000'
  )
  contract.on(filter, async (from, to, amount, event) => {
    console.log(`${from}, ${to}, ${amount}, ${event}`)
    console.log(event)
    const tokenId = event?.args?.tokenId?.toString()
    console.log(tokenId)

    if (tokenId !== undefined && tokenId !== '') {
      try {
        const result = await sqsManager.sendMessage(tokenId)
        console.log(result)
      } catch (error) {
        console.log(error)

        slackManager.postMessageToSlack(`Failed to send message to SQS. ${error}`)
          .then(data => {
            console.log('message was posted to slack.')
          })
          .catch(error => {
            console.log(error)
          })
      }
    } else {
      console.log('tokenId is undefined')
      const text = `tokenId is undefined......\ntokenId: ${tokenId}`
      slackManager.postMessageToSlack(text)
        .then(data => {
          console.log('message was posted to slack.')
        })
        .catch(error => {
          console.log(error)
        })
    }
  })
}

const init = () => {
  sqsManager.observeMessage()
  observeMint()
}

init()