# file-upload
A basic file upload tool running on Node.js &amp; socket.io

## How does it work ?
When the upload starts, the selected file is spliced into small chuncks. Then, the splice is sent to the server. When the data is received on the server, it is written on disk, and the server requests a new chunck. The same cycle is carried out until the file is fully uploaded.

