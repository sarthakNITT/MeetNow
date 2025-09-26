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
            if(recievedMessage.includes("join")) {
                checkJoinReq = true;
                ws.send(`join request recieved`);
                return;
            }
            ws.close();
            console.log("ws closed");
        }
    }
})

console.log(`listening on ${server.hostname}:${server.port}`);
