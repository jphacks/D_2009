
var clientVideoHeight;
var clientVideoWidth;
var hand_not_exist_times=0;
var card_hold_flag=0;
var moved_card=null;
var moved_card_idx=null;
var myCanvas;

async function HandDetection(){
    video=document.getElementById(PlayerIdtoVideo[yourid]);
    myCanvas=document.getElementById(CanvasIdtoName[yourid]);
    const net=await handpose.load();
    console.log("loaded");
    setInterval(()=>{
        detect(net);
    },100);
}

async function detect(net){
    const hand =await net.estimateHands(video);
    // console.log(hand);
    if(hand.length>0){
        // console.log("検出あり");
        OpenCloseJudger(hand);
    }else{
        hand_not_exist_times+=1;
        // console.log("検出なし");
        if(hand_not_exist_times>=4){
            //カードをリリース
            if(moved_card!=null){
                console.log("カードを自動リリース");
                hand_not_exist_times=0;
                moved_card=null;
                moved_card_idx=null;
                card_hold_flag=0;
            }
        }
    }
}

function OpenCloseJudger(predictions){
    setClientVideoSize(video);
    predictions.forEach((prediction)=>{
        // const bbbr=prediction.boundingBox.bottomRight;
        // const bbtl=prediction.boundingBox.topLeft;
        const landmarks=prediction.landmarks;
        const palmbase=prediction.annotations.palmBase[0];
        const thumb=prediction.annotations.thumb;
        const index=prediction.annotations.indexFinger;
        const middle=prediction.annotations.middleFinger;
        const ring=prediction.annotations.ringFinger;
        const pinky=prediction.annotations.pinky;
        const bbbr=prediction.boundingBox.bottomRight;
        const bbtl=prediction.boundingBox.topLeft;
        const center={
            x:bbtl[0]+(bbbr[0]-bbtl[0])/2,
            y:bbtl[1]+(bbbr[1]-bbtl[1])/2
        }
        // var ctx=document.getElementById(CanvasIdtoName[yourid]).getContext("2d");
        // ctx.beginPath();
        // ctx.arc(center.x,center.y,5,0,3*Math.PI);
        // ctx.fillStyle="indigo";
        // ctx.fill();
        // console.log("center");
        // console.log(center);
        const fingers=[thumb,index,middle,ring,pinky];
        var sum_angle_list=[];
        // var aspect=(bbbr[1]-bbtl[1])/(bbbr[0]-bbtl[0]);
        // console.log("aspect:"+(bbbr[1]-bbtl[1]));
        fingers.forEach((finger)=>{
            var sum_angle=0;
            for(var i=0;i<3;i++){
                var angle;
                if(i==0){
                    var edge1=(finger[0][0]-palmbase[0])**2+(finger[0][1]-palmbase[1])**2+(finger[0][2]-palmbase[2])**2
                    var edge2=(finger[1][0]-finger[0][0])**2+(finger[1][1]-finger[0][1])**2+(finger[1][2]-finger[0][2])**2
                    var edge3=(finger[1][0]-palmbase[0])**2+(finger[1][1]-palmbase[1])**2+(finger[1][2]-palmbase[2])**2
                    angle=Math.acos((edge1+edge2-edge3)/(2*Math.sqrt(edge1)*Math.sqrt(edge2)))*180/Math.PI
                }else{
                    var edge1=Math.sqrt((finger[i][0]-finger[i-1][0])**2+(finger[i][1]-finger[i-1][1])**2+(finger[i][2]-finger[i-1][2])**2)
                    var edge2=Math.sqrt((finger[i+1][0]-finger[i][0])**2+(finger[i+1][1]-finger[i][1])**2+(finger[i+1][2]-finger[i][2])**2)
                    var edge3=Math.sqrt((finger[i+1][0]-finger[i-1][0])**2+(finger[i+1][1]-finger[i-1][1])**2+(finger[i+1][2]-finger[i-1][2])**2)
                    angle=Math.acos((edge1+edge2-edge3)/(2*Math.sqrt(edge1)*Math.sqrt(edge2)))*180/Math.PI
                }
                sum_angle+=angle
            }
            sum_angle_list.push(sum_angle);
        })
        var open_finger_num=0;
        sum_angle_list.forEach((sum_angle)=>{
            // console.log(i+":"+sum_angle);
            if(sum_angle>=320){open_finger_num++;}
        })
        console.log("ここまで実行");
        if(open_finger_num>=3){
            //if hand is opened
            if(card_hold_flag==1){
                //カードをリリース
                console.log("カードをリリース");
                moved_card=null;
                moved_card_idx=null;
                hand_not_exist_times=0;
                card_hold_flag=0;
            }
        }else{
            //if hand is closed
            if(card_hold_flag==0){
                //カードをつかむ
                console.log("カードをつかむ");
                grip_card(center);
            }else{
                console.log("カードを動かす");
                move_card_byhand(center);
            }
        };
        
    })
}

function grip_card(center){
    if(startflag==0){return;}
    var x,y;
    var clientVideoSize=getClientVideoSize(video);
    var canvasRect=myCanvas.getBoundingClientRect();

    //キャンバスとビデオの幅が同じかどうか
    if(canvasRect.width>clientVideoSize.width-1 && canvasRect.width<clientVideoSize.width+1){
        x=((video.videoWidth-center.x)*clientVideoSize.width/video.videoWidth)/canvas_scale_list[yourid];
        y=(center.y*clientVideoSize.height/video.videoHeight)/canvas_scale_list[yourid];
    }else{
        x=((video.videoWidth-center.x)*clientVideoSize.width/video.videoWidth+(clientVideoSize.width-canvasRect.width)/2)/canvas_scale_list[yourid];
        y=(center.y*clientVideoSize.height/video.videoHeight)/canvas_scale_list[yourid];
    }

    // var cc=document.getElementById("canvas1");
    // var ctx=cc.getContext("2d");
    // ctx.beginPath();
    // ctx.arc(x,y,5,0,3*Math.PI);
    // ctx.fillStyle="indigo";
    // ctx.fill();

    var moved_player=player_list[yourid];
    if(moved_player.status=='pulled' && player_list[yourid].status=='pulled' || moved_player.status=='normal1' && player_list[yourid].status=='normal1'|| moved_player.status=='normal2' && player_list[yourid].status=='normal2'|| moved_player.status=='pull' && player_list[yourid].status=='pull'){//変更
    moved_player.cardlist.forEach((card,idx)=>{
        // console.log(card.position.y);
        if(card.position.x<=x && x<=card.position.x+TrumpWidth && card.position.y<=y && y<=card.position.y+TrumpHeight){
            moved_card=card;
            moved_card_idx=idx;
            }
        });
    }
    if(moved_card!=null){
        console.log("つかんだ");
        card_hold_flag=1;
    }
}

function move_card_byhand(center){
    if(startflag==0){return;}
    var x,y;
    var clientVideoSize=getClientVideoSize(video);
    var canvasRect=myCanvas.getBoundingClientRect();

    //キャンバスとビデオの幅が同じかどうか
    if(canvasRect.width>clientVideoSize.width-1 && canvasRect.width<clientVideoSize.width+1){
        x=((video.videoWidth-center.x)*clientVideoSize.width/video.videoWidth)/canvas_scale_list[yourid];
        y=(center.y*clientVideoSize.height/video.videoHeight)/canvas_scale_list[yourid];
    }else{
        x=((video.videoWidth-center.x)*clientVideoSize.width/video.videoWidth+(clientVideoSize.width-canvasRect.width)/2)/canvas_scale_list[yourid];
        y=(center.y*clientVideoSize.height/video.videoHeight)/canvas_scale_list[yourid];
    }
    let xoffset=(x-moved_card.position.x);
    let yoffset=(y-moved_card.position.y);
    
    moved_card.position.x += xoffset;
    moved_card.position.y += yoffset ;
    if(moved_card.position.x<0){moved_card.position.x=0;}
    else if(moved_card.position.y<0){moved_card.position.y=0;}
    else if(moved_card.position.x>450-TrumpWidth){moved_card.position.x=450-TrumpWidth;}
    else if(moved_card.position.y>300-TrumpHeight){moved_card.position.y=300-TrumpHeight;}
    socket.emit('move',yourid,moved_card,moved_card_idx);
    moved_card_idx=player_list[yourid].cardlist.length-1;
}

function setClientVideoSize(v) {
    // 元の動画のサイズ
    var orgW = v.videoWidth;
    var orgH = v.videoHeight;
    var orgR = orgH / orgW;

    var videoW = v.clientWidth;
    var videoH = v.clientHeight;
    var videoR = videoH / videoW;

    if(orgR > videoR){
        clientVideoHeight = v.clientHeight;
        clientVideoWidth = clientVideoHeight / orgR;
    }else{
        clientVideoWidth = v.clientWidth;
        clientVideoHeight = clientVideoWidth * orgR;
    }
}

function getClientVideoSize(v){
    var orgW = v.videoWidth;
    var orgH = v.videoHeight;
    var orgR = orgH / orgW;

    var videoW = v.clientWidth;
    var videoH = v.clientHeight;
    var videoR = videoH / videoW;
    var clientH;
    var clientW

    if(orgR > videoR){
        clientH = v.clientHeight;
        clientW = clientH / orgR;
    }else{
        clientW = v.clientWidth;
        clientH = clientW * orgR;
    }
    return {height:clientH,width:clientW}
}