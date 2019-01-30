const
  configuration = require("./configuration.json"),
  path = require("path"),
  request = require("request-promise");

const getFinishedRecordings = async () => {
  try {
    const response = await request(`http://${configuration.tvheadend_login}:${configuration.tvheadend_password}@${configuration.tvheadend_server}:${configuration.tvheadend_port}/api/dvr/entry/grid_finished?limit=1000000`);
    return Promise.resolve(response);
  }
  catch (error) {
    console.error("Error contacting the tvheadend API. Check your configuration.json file.");
    return Promise.reject(error);
  }
};

const main = async () => {
  const result = JSON.parse(await getFinishedRecordings());
  const files = result.entries.map((video) => path.basename(video.filename));
  console.log("OK");
};

main();
