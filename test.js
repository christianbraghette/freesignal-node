
const express = require('express');
const { DecodeUTF8 } = require('fflate');

const app = express();

app.use(express.raw());
//app.use(express.json());

app.all('/messages', (req, res) => {
    // Assuming req.body.datagrams is an array of datagram strings
    //const datagrams = JSON.parse(req.body);

    console.log("Body: ", JSON.parse(new TextDecoder().decode(req.body)));

    const data = {
        id: "Dio"
    }
    // Process the datagrams here
    // For example, save them to a database or send them to another service

    res.status(200).type("application/octet-stream").send(data);
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');

    fetch('http://localhost:3000/messages', {
        method: 'POST',
        headers: {
            'Content-Type': //'application/json'
                'application/octet-stream'
        },
        body: JSON.stringify({
            id: "Dio"
        })
    }).then(async data => new Uint8Array(await data.arrayBuffer())).then(data => console.log(JSON.parse(new TextDecoder().decode(data))));
});

