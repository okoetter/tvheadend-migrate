const
  configuration = require("./configuration.json"),
  path = require("path"),
  fs = require("fs"),
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

const getFilesToImport = () => {
  const allFiles = fs.readdirSync(configuration.source_video_files_folder);
  return allFiles.filter((element) => element.match(configuration.source_regex_video_files));
};

const main = async () => {
  const result = JSON.parse(await getFinishedRecordings());
  const filesInDb = result.entries.map((video) => path.basename(video.filename));
  const filesToImport = getFilesToImport();
  console.log("OK");
};

main();
