interface roomInterface {
    roomId: string,
    peers: {
        peerSocket: any,
        peerId: string,
        peerName: string
    }[],
    messages?: {
        from: string,
        text: string,
        ts: number
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
                            
                            ws.send(JSON.stringify({
                                "type": "JoinRequest",
                                "value": "Joined room",
                                "roomId": msg.roomId,
                                "roomInfo": rooms
                            }));
                            
                            existingRoom.peers.forEach(async (peer)=>{
                                if(peer.peerId !== msg.peerId) {
                                    peer.peerSocket.send(JSON.stringify({
                                        "type": "new-peer",
                                        "value": `peerId: ${msg.peerId}, peerName: ${msg.name}`,
                                        "roomId": `${msg.roomId}`,
                                        "roomInfo": rooms
                                    }))
                                }
                            })
                        }
                    }
                }
                if(msg.type === "offer"){
                    const targetPeerId = msg.to;
                    const roomId = msg.roomId;
                    const room = rooms.find(r => r.roomId === roomId);
                    if(room){
                        const targetPeer = room.peers.find(peer => peer.peerId === targetPeerId);
                        if(targetPeer){
                            targetPeer.peerSocket.send(JSON.stringify({
                                "type": "offer",
                                "from": msg.from,
                                "sdp": msg.sdp
                            }));
                        }
                    }
                }
                if(msg.type === "answer"){
                    const targetPeerId = msg.to;
                    const roomId = msg.roomId;
                    const room = rooms.find(r => r.roomId === roomId);
                    if(room){
                        const targetPeer = room.peers.find(peer => peer.peerId === targetPeerId);
                        if(targetPeer){
                            targetPeer.peerSocket.send(JSON.stringify({
                                "type": "answer",
                                "from": msg.from,
                                "sdp": msg.sdp
                            }));
                        }
                    }
                }
                if(msg.type === "ice-candidate"){
                    const targetPeerId = msg.to;
                    const roomId = msg.roomId;
                    const room = rooms.find(r => r.roomId === roomId);
                    if(room){
                        const targetPeer = room.peers.find(peer => peer.peerId === targetPeerId);
                        if(targetPeer){
                            targetPeer.peerSocket.send(JSON.stringify({
                                "type": "ice-candidate",
                                "from": msg.from,
                                "candidate": msg.candidate
                            }));
                        }
                    }
                }
                if(msg.type === "chat"){
                    const message = JSON.stringify({
                        "type": "chat",
                        "value": `${msg.value}`,
                        "roomId": `${msg.roomId}`,
                        "sendFrom": `${msg.sendFrom}`
                    })
                    const room = rooms.find((e: any) => e.roomId === msg.roomId)
                    room?.messages?.push({
                        text: msg.value,
                        from: msg.sendFrom,
                        ts: Date.now()
                    })
                    if(room && room.peers && room.peers.length > 0){
                        for(const peer of room.peers){
                            peer.peerSocket.send(message)
                        }
                    }
                }
                if(msg.type === "leave"){
                    const room = rooms.find((e: any) => e.roomId === msg.roomId);
                    if(room){
                        room.peers = room.peers.filter((e: any) => e.peerId !== msg.peerId);
                    }
                    if(room?.peers.length === 0){
                        console.log(`Room ${msg.roomId} is empty, closing the room.`);
                        rooms = rooms.filter((r) => r.roomId !== msg.roomId);
                        try {
                            ws.close();
                        } catch (error) {
                            console.log(`Error while closing room: ${error}`);
                            
                        }
                    }else {
                        const message = JSON.stringify({
                            "type": "peer-left",
                            "peerId": `${msg.peerId}`
                        })
                        if(room){
                            for(const peer of room?.peers){
                                peer.peerSocket.send(message);
                            }
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
        ,
        close (ws) {
            try {
                for (const room of rooms) {
                    const before = room.peers.length;
                    room.peers = room.peers.filter((p: any) => p.peerSocket !== ws);
                    if (room.peers.length !== before) {
                        const msg = JSON.stringify({ "type": "peer-left", "peerId": "unknown" });
                        for (const peer of room.peers) {
                            try { peer.peerSocket.send(msg); } catch {}
                        }
                    }
                }
                rooms = rooms.filter((r) => r.peers.length > 0);
            } catch (e) {
                console.log(`Error on ws close: ${e}`);
            }
        }
    }
})