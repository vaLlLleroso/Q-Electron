@echo off
echo === installing python deps ===
pip install -r requirements.txt

echo === installing node/electron deps ===
cd QuareroElectron\electron
npm install

echo === building docker image ===
docker build -t quarero-app .

echo === done ===
pause