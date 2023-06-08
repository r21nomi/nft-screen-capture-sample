import AWS from 'aws-sdk'
import puppeteer from 'puppeteer'
import fetch from 'node-fetch'

export const imageUploader = {
  upload: async (tokenId) => {
    console.log(`uploading ${tokenId}...`)

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID_1,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_1,
    })

    const ENDPOINT = process.env.ARTWORK_ENDPOINT
    const artworkUrl = `${ENDPOINT}`
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setViewport({width: 900, height: 900});
    await page.goto(artworkUrl, {
      "timeout": 180 * 1000,
      "waitUntil" : "networkidle0"
    })
    // await page.waitForTimeout(10000)
    const buf = await page.screenshot()

    const uploadedImage = await s3.upload({
        Bucket: `${process.env.AWS_S3_BUCKET_NAME}`,
        Key: `${process.env.AWS_S3_BUCKET_PATH}/${tokenId}.png`,
        Body: buf,
        ContentType: 'image/png'
    }).promise()

    await browser.close()

    return uploadedImage.Location
  }
}