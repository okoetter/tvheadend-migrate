// beginning with tvheadend 4.3 you need to set authentication mode to "plain" or "Both plain and digest"
// in Base settings/HTTP Server SEttings (Expert view level only)

const
  configuration = require("./configuration.json"),
  path = require("path"),
  fs = require("fs"),
  axios = require("axios");

const getFinishedRecordings = async () => {
  try {
    const response = await axios.get(`http://${configuration.tvheadend_login}:${configuration.tvheadend_password}@${configuration.tvheadend_server}:${configuration.tvheadend_port}/api/dvr/entry/grid_finished?limit=1000000`);
    return Promise.resolve(response.data);
  }
  catch (error) {
    console.error("Error contacting the tvheadend API. Check your configuration.json file.");
    console.error(error);
    return Promise.reject(error);
  }
};

const getFilesToImport = (tvhFiles) => {
  const allFiles = fs.readdirSync(configuration.source_video_files_folder, { withFileTypes: true });
  const filterFiles = allFiles.filter((element) => element.isFile() && element.name.match(configuration.source_regex_video_files));

  // return the difference of all found files - those already in database
  return filterFiles.filter((element) => tvhFiles.indexOf(element.name) < 0);
};

const main = async () => {
  const finishedTvhRecordings = await getFinishedRecordings();
  const tvhFiles = finishedTvhRecordings.entries.map((video) => path.basename(video.filename));
  const filesToImport = getFilesToImport(tvhFiles);

  console.log("OK");
};

main();
