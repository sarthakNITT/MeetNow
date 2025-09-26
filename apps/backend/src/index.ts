const rooms = new Map<string, Set<string>>();
const peers = new Map<string, {socket: any, roomId: string, name: string}>();

let checkJoinReq = false;
const server = Bun.serve({
    port: 8080,
    fetch(req, server) {
        const success = server.upgrade(req);
        if(success) {
            return undefined;
        }
        return new Response("hello world")
    },
    websocket: {
        open(ws){
            let result = '';
            const ch = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
            const length = 5;
            for(let i=0;i<length;i++){
                result += ch.charAt(Math.floor(Math.random() * ch.length));
            }
            const socketId = result;
            ws.send(socketId);
            setTimeout(() => {
                if(!checkJoinReq){
                    ws.close();
                    console.log("ws closed");
                    
                    return;
                }
            }, 10000);
        },
        message(ws, message) {
            const recievedMessage = JSON.stringify(message);
            if(!recievedMessage.includes("join")) {
                ws.close();
                console.log("ws closed");
            }
            checkJoinReq = true;
            ws.send(`join request recieved`);
            if(!recievedMessage.includes("roomId") || !recievedMessage.includes("peerId") || !recievedMessage.includes("name")){
                ws.send(`{ "type": "error", "message": "Invalid join message" }`)
                ws.close();
                console.log("ws closed");
                return;
            }
            const msg = JSON.parse(recievedMessage);
            if(!rooms.has(msg.roomId)){
                rooms.set(msg.roomId, new Set());
                console.log("new room created");
            }else{
                console.log("Room already exists");
            }
            rooms.get(msg.roomId)?.add(msg.peerId);
            peers.set(msg.peerId, {socket: ws, roomId: msg.roomId, name: msg.name});
            ws.send(`{ type: "joined", peers: ${peers}}`);
            peers.forEach((e)=>{
                if(e.roomId === msg.roomId){
                    ws.send(`{ type: "new-peer", peer: { ${msg.peerId}, ${msg.name} } }`);
                }
            })
        }
    }
})

console.log(`listening on ${server.hostname}:${server.port}`);
