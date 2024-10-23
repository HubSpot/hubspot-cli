rm -rf ./dist/
yarn tsc
cp -r lang dist/lang
cp bin/hs dist/bin/hs
cp bin/hscms dist/bin/hscms
cp README.md dist/README.md
cp LICENSE dist/LICENSE
