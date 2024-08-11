import fetch from 'node-fetch';
import { config } from '../utils.js';
import https from 'https';
import { ScrapflyClient, ScrapeConfig } from 'scrapfly-sdk';
import { needScrapingProvider } from './scrapingAnt.js';
const agent = new https.Agent({
  rejectUnauthorized: false,
});
const MAX_RETRIES = 5;

async function handleScrapingProvider(context, callback, retriesCount = 0) {
  let apiKey = config.scrapingAnt?.apiKey || '';
  try {
    const client = new ScrapflyClient({ key: apiKey });
    const apiResponse = await client.scrape(
      new ScrapeConfig({
        tags: ['player', 'project:default'],
        asp: true,
        render_js: true,
        url: context.url,
        auto_scroll: true,
        country: 'de',
      }),
    );
    const result = apiResponse.result.content;
    callback(null, result);
  } catch (exception) {
    if (retriesCount < MAX_RETRIES) {
      console.error(`Error while trying to scrape data from Scrapfly. Received error: ${exception.message}. Retrying ${retriesCount + 1}/${MAX_RETRIES} ...`);
      await handleScrapingProvider(context, callback, retriesCount + 1);
    }
    console.error(`Error while trying to scrape data from Scrapfly. Received error: ${exception.message}`);
    callback(null, []);
  }
}

async function handleRegularRequest(context, headers, cookies, callback) {
  try {
    const response = await fetch(context.url, {
      headers: {
        ...headers,
        Cookie: cookies,
      },
      agent,
    });
    const result = await response.text();
    callback(null, result);
  } catch (exception) {
    console.error(`Error while trying to scrape data. Received error: ${exception.message}`);
    callback(null, []);
  }
}

function makeDriver(providerID, headers = {}) {
  let cookies = '';
  return async function driver(context, callback) {
    if (needScrapingProvider(providerID)) {
      await handleScrapingProvider(context, callback);
    } else {
      /**
        * The regular request driver is taking care of everyting, that doesn't need to be scraped by ScrapingAnt (which is
        * everything != Immoscout & Immonet as of writing this)
      */
      await handleRegularRequest(context, headers, cookies, callback);
    }
  };
}
export default makeDriver;
