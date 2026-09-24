#!/bin/bash
# usage: options/make_option.sh <option_dir_name> <Label>  -> launch/options/<name>.mp4 (video stream copied, new mix)
set -e
cd "$(dirname "$0")/../.."
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
python3 audio/mix.py audio/options/$1/music.wav audio/options/$1/soundtrack.wav
mkdir -p options
$FF -y -loglevel error -i out/the_wedding_chapter_app_launch.mp4 -i audio/options/$1/soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "options/the_wedding_chapter_launch_$1.mp4"
ls -la "options/the_wedding_chapter_launch_$1.mp4"
