interface roomInterface {
    roomId: string,
    peers: {
        peerSocket: any,
        peerId: string,
        peerName: string
    }[]
}

let checkJoinReq = false;
let rooms: roomInterface[] = [];

Bun.serve({
    port: 8080,
    fetch(req, server) {
        if (server.upgrade(req)) {
            return;
        }
        return new Response("Upgrade failed", { status: 500 });
    },
    websocket: {
        open (ws) {
            let socketId = '';
            const characters = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890!@#$%^&*()';
            const length = 8;
            for(let i=0;i<length;i++){
                socketId += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            console.log(`SocketId: ${socketId}`);
            ws.send(JSON.stringify({
                "type": "connection",
                "value": `${socketId}`
            }))
            setTimeout(() => {
                if(!checkJoinReq){
                    console.log(`No joining request for 10 sec, Closing the Websocket`);
                    ws.close();
                    return;
                }
            }, 10000);
        }, 
        message (ws, message: string) {
            console.log(message);
            try {
                const msg = JSON.parse(message);
                if(msg.type === "join"){
                    checkJoinReq = true;
                    console.log(`Join request recieved`);
                    if(!msg.roomId || !msg.peerId || !msg.name){
                        console.log(`Incorrect message type`);
                        return;
                    }
                    const checkExistingRoom = rooms.filter((e)=>e.roomId === msg.roomId);
                    console.log(`rooms: ${checkExistingRoom}`);
                    if(checkExistingRoom.length === 0){
                        console.log(`Creating room`);
                        rooms.push({
                            roomId: msg.roomId,
                            peers: [{
                                peerSocket: ws,
                                peerId: msg.peerId,
                                peerName: msg.name
                            }]
                        })
                        ws.send(JSON.stringify({
                            "type": "JoinRequest",
                            "value": "Joined room",
                            "roomId": `${msg.roomId}`
                        }))
                    }else{
                        console.log(`Room already exists, adding peer`);
                        const existingRoom = rooms.find(room => room.roomId === msg.roomId);
                        if(existingRoom){
                            existingRoom.peers.push({
                                peerSocket: ws,
                                peerId: msg.peerId,
                                peerName: msg.name
                            });
                            existingRoom.peers.forEach(async (peer)=>{
                                peer.peerSocket.send(JSON.stringify({
                                    "type": "new-peer",
                                    "value": `peerId: ${msg.peerId}, peerName: ${msg.name}`,
                                    "roomId": `${msg.roomId}`,
                                    "roomInfo": rooms
                                }))
                            })
                        }
                    }
                }
                if(msg.type === "offer"){
                    const targetPeerId = msg.to;
                    for(const room of rooms){
                        const targetPeer = room.peers.find(peer => peer.peerId === targetPeerId);
                        if(targetPeer){
                            targetPeer.peerSocket.send(JSON.stringify({
                                "type": "offer",
                                "from": msg.from,
                                "sdp": msg.sdp
                            }));
                            break;
                        }
                    }
                }
            } catch (error) {
                console.log(`JSON Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                console.log(`Received message: ${message}`);
                ws.send(JSON.stringify({
                    "type": "error",
                    "value": "Invalid JSON message format"
                }));
            }
        }
    }
})