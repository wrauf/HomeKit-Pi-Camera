/***********************************Camera details***********************************************/
var CameraName = "Node Camera";
var CameraPort = 51062;
var CameraPinCOde = "031-45-154";
var CameraUserName = "EC:22:3D:D3:CE:CE";


var ResolutionWidth = 1920;
var ResolutionHeight = 1080;
var CameraFPS = 30;
var CameraBitRate = 300;


/***********************************Camera details***********************************************/

var storage = require('node-persist');
var uuid = require('hap-nodejs').uuid;
var Accessory = require('hap-nodejs').Accessory;
var Camera = require('hap-nodejs').Camera;


//var core = require('hap-nodejs/CameraCore.js');
//var Camera = require('hap-nodejs').Camera;
//var uuid = require('hap-nodejs/lib/util/uuid.js');
const spawn = require('child_process').spawn;
var shell = require('shelljs');
var fs = require('fs');

console.log("HAP-NodeJS starting...");

//Initialize our storage system
storage.initSync();
console.log("Storage system initialized...");

// Since we are hosting independent accessoris start by creating a camera accessory.
var cameraUUID = uuid.generate(CameraName);
console.log(CameraName + " UUID is: " + cameraUUID);

var cameraAccessory = new Accessory(CameraName, uuid.generate(CameraName));
console.log(CameraName + " (accessory) initialized......");

//create a camera
var cameraSource = new Camera();

// Snaphost request handler
Camera.prototype.handleSnapshotRequest = function (request, callback) {
  var raspistill = `raspistill -w ${request.width} -h ${request.height} -t 10 -o ./snapshots/snapshot.jpg`;

  shell.exec(raspistill, function (code, stdout, stderr) {
    var snapshot = undefined;
    if (code === 0) {
      snapshot = fs.readFileSync(__dirname + '/snapshots/snapshot.jpg');
    }
    callback(stderr, snapshot);
  });
}

// Stream request handler
Camera.prototype.handleStreamRequest = function (request) {
  // Invoked when iOS device asks stream to start/stop/reconfigure
  var sessionID = request["sessionID"];
  var requestType = request["type"];
  if (sessionID) {
    let sessionIdentifier = uuid.unparse(sessionID);

    if (requestType == "start") {
      var sessionInfo = this.pendingSessions[sessionIdentifier];
      if (sessionInfo) {
        var width = ResolutionWidth;
        var height = ResolutionHeight;
        var fps = CameraFPS;
        var bitrate = CameraBitRate;

        let videoInfo = request["video"];
        if (videoInfo) {
          width = videoInfo["width"];
          height = videoInfo["height"];

          let expectedFPS = videoInfo["fps"];
          if (expectedFPS < fps) {
            fps = expectedFPS;
          }

          bitrate = videoInfo["max_bit_rate"];
          console.log('bitrate: ', bitrate);
        }

        let targetAddress = sessionInfo["address"];
        let targetVideoPort = sessionInfo["video_port"];
        let videoKey = sessionInfo["video_srtp"];

        // let ffmpegCommand = '-f video4linux2 -i /dev/video0 -threads 0 -vcodec libx264 -an -pix_fmt yuv420p -r '+ fps +' -f rawvideo -tune zerolatency -vf scale=w='+ width +':h='+ height +' -b:v '+ bitrate +'k -bufsize '+ bitrate +'k -payload_type 99 -ssrc 1 -f rtp -srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params '+videoKey.toString('base64')+' srtp://'+targetAddress+':'+targetVideoPort+'?rtcpport='+targetVideoPort+'&localrtcpport='+targetVideoPort+'&pkt_size=1378';
        let ffmpegCommand = '-f video4linux2 -i /dev/video0 -s ' + width + ':' + height + ' -threads auto -vcodec h264 -an -pix_fmt yuv420p -f rawvideo -tune zerolatency -vf scale=w=' + width + ':h=' + height + ' -b:v ' + bitrate + 'k -bufsize ' + 2 * bitrate + 'k -payload_type 99 -ssrc 1 -f rtp -srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params ' + videoKey.toString('base64') + ' srtp://' + targetAddress + ':' + targetVideoPort + '?rtcpport=' + targetVideoPort + '&localrtcpport=' + targetVideoPort + '&pkt_size=1378';

        console.log('avconv stream: ', ffmpegCommand);
        let ffmpeg = spawn('avconv', ffmpegCommand.split(' '), { env: process.env });
        this.ongoingSessions[sessionIdentifier] = ffmpeg;
      }

      delete this.pendingSessions[sessionIdentifier];
    } else if (requestType == "stop") {
      var ffmpegProcess = this.ongoingSessions[sessionIdentifier];
      if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
      }

      delete this.ongoingSessions[sessionIdentifier];
    }
  }
}

//set the camera accessory source.
cameraAccessory.configureCameraSource(cameraSource);
console.log("Camera source configured......");

//hook up events.
cameraAccessory.on('identify', function(paired, callback) {
  console.log(CameraName + " identify invoked...");
  callback(); // success
});

// Publish the camera on the local network.
cameraAccessory.publish({
  username: CameraUserName,
  port: CameraPinCOde,
  pincode: CameraPinCOde,
  category: Accessory.Categories.CAMERA
}, true);

