// beginning with tvheadend 4.3 you need to set authentication mode to "plain" or "Both plain and digest"
// in Base settings/HTTP Server Settings (Expert view level only)

const
  configuration = require("./configuration.json"),
  path = require("path"),
  fs = require("fs"),
  axios = require("axios"),
  moment = require("moment");

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
  return allFiles
    .filter((element) => element.isFile() && element.name.match(configuration.source_regex_video_files)) // only files which name matches config
    .filter(element => !tvhFiles.includes(element.name)) // only files that are not already in tvh db
    .map(element => element.name); // return only name property
};

const getVideoDurations = async (files) => {
  const result = [];
  const { getVideoDurationInSeconds } = require("get-video-duration");

  for (const filename of files) {
    try {
      const duration = await getVideoDurationInSeconds(path.join(configuration.source_video_files_folder, filename));
      result.push(Math.round(duration));
    }
    catch(e) {
      console.log(`Error in file: ${filename}`, e);
      result.push("unknown");
    }
  }

  return result;
};

const writeCSV = (filesToImport, durations) => {
  const fs = require("fs");
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(__dirname, configuration.csv_file));

    // write header
    file.write("filename\tduration\ttitle\tchannel name\tstart time\r\n");
    for (let i = 0; i < filesToImport.length; i++) {
      file.write(`${filesToImport[i]}\t${durations[i]}\r\n`);
    }
    file.end();
    file.on("finish", () => { resolve(true); });
  });
};

const readCSV = async () => {
  const fs = require("fs");
  const readline = require('readline');

  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(__dirname, configuration.csv_file)),
    crlfDelay: Infinity
  });

  let firstRow = true;
  let result = [];
  for await (const line of rl) {
    if (firstRow) firstRow = false; // ignore first row
    else result.push(line);
  }

  return result;
};

const sendToApi = async (tvhFiles) => {
  /*const postdata = {
    // "enabled": true,
    "start": 1509000000,
    "stop":  1509003600,
    "channelname": "Das Erste HD test",
    "title": { "ger": "my title node 2" },
    // "subtitle": { "ger": "filename: my video" },
    // "description": { "ger": "my description" },
    // "comment": "added by tvh_addfile.py",
    "files": [ { "filename": "/recordings/Tagesschau - --Das Erste HD2020-04-1220-00.ts" } ]
  };*/
  let lines = [];
  try {
    lines = await readCSV();
  }
  catch (error) {
    console.error(`Error reading ${configuration.csv_file}.`);
    console.error(error);
    return
  }

  moment().format();
  //const test = await axios.post(`http://${configuration.tvheadend_login}:${configuration.tvheadend_password}@${configuration.tvheadend_server}:${configuration.tvheadend_port}/api/dvr/entry/remove`, "uuid=3e3710a0c612d9a9325d1e2fb389a2fe");


  for (const line of lines) {
    let filename = "";
    try {
      const parts = line.split("\t");
      if (parts.length >= 5) {
        if (tvhFiles.includes(parts[0])) continue;
        filename = path.join(configuration.tvheadend_recordings_folder, parts[0]);
        filename = filename.split(path.sep).join("/"); // replace \ with / under Windows
        if (fs.existsSync(path.join(configuration.source_video_files_folder, parts[0]))) {
          const startTime = moment(parts[4]);
          const endTime = startTime
            .clone()
            .add(Number(parts[1]), "seconds")
            .subtract(configuration.pre_recording_padding_minutes, "minutes")
            .subtract(configuration.post_recording_padding_minutes, "minutes");

          const postdata = {
            "start": startTime.unix(),
            "start_extra": configuration.pre_recording_padding_minutes,
            "stop": endTime.unix(),
            "stop_extra": configuration.post_recording_padding_minutes,
            "channelname": parts[3],
            "title": {},
            "files": [ { "filename": filename }]
          };
          postdata.title[configuration.country] = parts[2];

          const response = await axios.post(`http://${configuration.tvheadend_login}:${configuration.tvheadend_password}@${configuration.tvheadend_server}:${configuration.tvheadend_port}/api/dvr/entry/create`, `conf=${JSON.stringify(postdata)}`);
          if (response.status !== 200) {
            console.error(`Video rejected from API: ${parts[0]}`);
            console.error(response.statusText);
          }
        }
        else {
          console.error(`Video file not found: ${parts[0]}`);
        }
      }
    }
    catch (error) {
      console.error(`Error adding ${filename}`);
      console.error(error);
      console.error(error.config.data)
    }
  }
};

(async () => {
  const finishedTvhRecordings = await getFinishedRecordings();
  const tvhFiles = finishedTvhRecordings.entries.map((video) => path.basename(video.filename));
  const filesToImport = getFilesToImport(tvhFiles);

  // if csv file exists then import
  if (fs.existsSync(path.join(__dirname, configuration.csv_file)))
    await sendToApi(tvhFiles);
  else { // create csv file
    const durations = await getVideoDurations(filesToImport);
    await writeCSV(filesToImport, durations);
  }

  console.log("OK");
})();

