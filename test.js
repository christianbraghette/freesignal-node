
const express = require('express');

const app = express();

app.use(express.raw());
app.use(express.json());

app.all('/messages', (req, res) => {
    // Assuming req.body.datagrams is an array of datagram strings
    //const datagrams = JSON.parse(req.body);

    console.log("Body: ", req.body instanceof Uint8Array);

    // Process the datagrams here
    // For example, save them to a database or send them to another service

    res.status(200).type("application/octet-stream").send(new Uint8Array(5).fill(48));
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');

    fetch('http://localhost:3000/messages', {
        method: 'POST',
        headers: {
            'Content-Type': //'application/json'
            'application/octet-stream'
        },
        body: new Uint8Array(10).fill(45)
            //JSON.stringify({ test: "Dio" })
    }).then(async data => [data.headers.get('Content-Type'), new Uint8Array(await data.arrayBuffer())]).then(async data => console.log(await data[0], await data[1]));
});

