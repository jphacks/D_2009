const inkButton=document.getElementById('ink-button');

const inkHW=200;
var inkFlag=0;
var inkCanvasImgList={}
const SkillMsg=document.getElementById('skill-msg')


function setInkFlag(){
    if(startflag==0){return;}
    console.log("インク");
    if(inkFlag!=2){SkillMsg.innerHTML='インクをかけるプレイヤーを選択してください';}
    if(inkFlag==0){
        inkFlag=1;
        inkButton.textContent='ON';
    }
    else if(inkFlag==1){
        inkFlag=0;
        inkButton.textContent='スキル';
    }
};

function chooseInkArea(event){
    if(inkFlag==0){return;}
    inkFlag=2; //以降はインクを使えない
    inkButton.textContent="使用済";
    if(startflag==0){return;}
    console.log(event.currentTarget.id);
    var canvasrect = event.currentTarget.getBoundingClientRect();
    console.log(canvasrect);
    const x=(event.clientX-canvasrect.left)/canvas_scale_list[InkOnlyCanvasNametoId[event.currentTarget.id]];
    const y=(event.clientY-canvasrect.top)/canvas_scale_list[InkOnlyCanvasNametoId[event.currentTarget.id]];
    SkillMsg.innerHTML='';
    socket.emit('shot',yourid,InkOnlyCanvasNametoId[event.currentTarget.id],x,y);
}

function show(alart_img)
{
    alart_img.style.visibility = "visible";
}
// 点滅「off」状態
function hide(alart_img)
{
    alart_img.style.visibility = "hidden";
}

socket.on('shotted',(shot_id,shotted_id,x,y)=>{
    console.log('skill発動');
    const alart_img=document.getElementById("alart_img");

    if(shotted_id==1){
        alart_img.style.top='0%';
        alart_img.style.left='0%';
    }
    else if(shotted_id==2){
        alart_img.style.top='0%';
        alart_img.style.left='50%';
    }
    else if(shotted_id==3){
        alart_img.style.top='45%';
        alart_img.style.left='0%';
    }
    else{
        alart_img.style.top='45%';
        alart_img.style.left='50%';
    }
    VmdControl("loop", false,shotted_id);
    for(var i=0; i < 5000; i=i+1000){
        setTimeout(()=>{show(alart_img);},i);
        setTimeout(()=>{hide(alart_img);},i+500);
    }
    setTimeout(()=>{
        console.log('x:'+x+'y:'+y);
        var inkCanvas=document.getElementById('ink-canvas'+shotted_id);
        var shotted_card_list=[];
        var shotted_card_idx_list=[];
        var inkoffset_list=[];
        inkCanvas.style.zIndex=2;
        var context=inkCanvas.getContext('2d');
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = "#990000";
        context.fillRect(0,0,inkCanvas.width,inkCanvas.height);
        player_list[shotted_id].cardlist.forEach((card,idx)=>{
            if(!(card.position.x<=(x-inkHW/2-TrumpWidth) || (card.position.x<=(x-inkHW/2) && card.position.x<(x+inkHW/2) && (card.position.y>=y+inkHW/2 || card.position.y<=y-inkHW/2-TrumpHeight)) || card.position.x>=(x+inkHW/2))){
                if(card.mark=='joker'){
                    const CardImage=document.getElementById('joker');
                    context.drawImage(CardImage,card.position.x*canvas_scale_list[shotted_id],card.position.y*canvas_scale_list[shotted_id],TrumpWidth*canvas_scale_list[shotted_id],TrumpHeight*canvas_scale_list[shotted_id]);
                }else{
                    const CardImage=document.getElementById(card.mark+'-'+String(card.number));
                    context.drawImage(CardImage,card.position.x*canvas_scale_list[shotted_id],card.position.y*canvas_scale_list[shotted_id],TrumpWidth*canvas_scale_list[shotted_id],TrumpHeight*canvas_scale_list[shotted_id]);
                }
                card.inkoffset={x:card.position.x-x,y:card.position.y-y,id:shot_id}
                // console.log(card);
                shotted_card_list.push(card);
                shotted_card_idx_list.push(idx);
                // console.log('cardposition');
                // console.log(card.position);
                // console.log('inkx'+x);
                // console.log('inky'+y);
            }
        });
        socket.emit('card_shotted',shotted_id,shotted_card_list,shotted_card_idx_list);
        // const inkImage=document.getElementById('ink');
        // inkImage.style.width=inkHW*canvas_scale_list[id];
        // inkImage.style.height=inkHW*canvas_scale_list[id];
        // context.globalCompositeOperation = 'destination-in';
        // context.drawImage(inkImage,(x-inkHW/2)*canvas_scale_list[id],(y-inkHW/2)*canvas_scale_list[id],inkHW*canvas_scale_list[id],inkHW*canvas_scale_list[id]);
        const inkOnlyCanvas=document.getElementById('ink-only-canvas'+shotted_id);
        const inkTransImg=document.getElementById('ink-trans');
        var trans_ctx=inkOnlyCanvas.getContext('2d');
        trans_ctx.drawImage(inkTransImg,(x-inkHW/2)*canvas_scale_list[shotted_id],(y-inkHW/2)*canvas_scale_list[shotted_id],inkHW*canvas_scale_list[shotted_id],inkHW*canvas_scale_list[shotted_id]);
        setTimeout(()=>{
            trans_ctx.clearRect(0,0,inkOnlyCanvas.width,inkOnlyCanvas.height);
        },5000);
        console.log("終了");
    },5000);
})