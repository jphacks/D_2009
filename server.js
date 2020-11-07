const express = require('express');
const http=require('http');
const path = require('path');
const socketIO = require('socket.io');
const redis = require("redis");
const app = express();
const server = http.Server(app);
const io = socketIO(server);
const port=process.env.PORT || 3000

const mark={
  1:'heart',
  2:'spade',
  3:'diamond',
  4:'club',
  5:'joker'
};
const ALL_CARD_NUM=53;
class Player{
  constructor(id){
    this.cardlist=[];
    this.id=id;
    this.status=null;
    this.rank=0;
  }
}

function executive_access(socket,redisClient,roomid,playerid=0){
  redisClient.watch(roomid,(watchError)=>{
    if(watchError)throw watchError;
    redisClient.get(roomid,(error, value) =>{
      if(error)throw error;
      var roomObject=JSON.parse(value);
      console.log(roomObject);
      roomObject.playerid++;
      roomObject.player_num++;
      if(playerid){
        const player=new Player(playerid);
        roomObject.player_list[playerid]=player;
      }
      else{
        const player=new Player(roomObject.playerid);
        roomObject.player_list[roomObject.playerid]=player;
      }
      console.log(roomObject);
      redisClient
      .multi()
      .set(roomid, JSON.stringify(roomObject))
      .exec((error,results)=>{
        if(error)throw error;
        console.log('results='+results);
        if(results==null){
          executive_access(socket,redisClient,roomid,playerid);
        }
        if(playerid){
          socket.emit('joined', playerid);
        }else{
          socket.emit('joined',roomObject.playerid);
        }
      })
    });
  })
}

function pullcard(playerObject,pulled_card_idx){
  playerObject.cardlist.splice(pulled_card_idx,1);
}
function addcard(playerObject,card){
  playerObject.cardlist.push(card);
}
function setstatus(playerObject,status){
  playerObject.status=status;
}

class Card{
  constructor(mark,number){
    this.mark=mark;
    this.number=number;
    this.position={
      x:0,
      y:0
    };
    this.inkoffset={
      x:null,
      y:null,
      id:null
    }
  }
}

function shuffle_and_distribute(roomObject){
  let all_card=[]
  for(var num=1;num<=13;num++){
    for(mk=1;mk<=4;mk++){
      const card=new Card(mark[mk],num);
      all_card.push(card);
    }
  }
  const card=new Card(mark[5],14);
  all_card.push(card);
  //shuffle
  for(var time=0;time<200;time++){
    const idx1=Math.floor( Math.random() * ALL_CARD_NUM );
    const idx2=Math.floor( Math.random() * ALL_CARD_NUM );
    all_card=shuffle(all_card,idx1,idx2);
  }
  //distribute
  var dist_id=1;
  all_card.forEach((card)=>{
    card.position.x=50+Math.floor(((350-68)*roomObject.player_list[dist_id].cardlist.length)/Math.floor(ALL_CARD_NUM/roomObject.player_num));
    card.position.y=100;
    distribute(roomObject,dist_id,card);
    dist_id=dist_id%roomObject.player_num+1;
  });
  return all_card;
}

function shuffle(array, idx1, idx2) {
  const result = [...array];
  [result[idx1], result[idx2]] = [array[idx2], array[idx1]];
  return result;
}

function distribute(roomObject,id,card){
  addcard(roomObject.player_list[id],card);
}

function throw_cards(cardlist){
  var after_cardlist=Array.from(cardlist);
  var redunduncy_checker={};
  cardlist.forEach((card,idx)=>{
    if(typeof redunduncy_checker[card.number]=='undefined'){
      redunduncy_checker[card.number]=idx;
    }else{
      delete after_cardlist[idx];
      delete after_cardlist[redunduncy_checker[card.number]];
      delete redunduncy_checker[card.number];
    }
  });
  after_cardlist=after_cardlist.filter((value)=>{
    return typeof value!=undefined;
  });
  return after_cardlist;
}

io.on('connection',function(socket){
  let roomObject;
  var playerid;
  var player_num;
  var winner_num;
  let player_list;
  let player
  let timer;
  const redisClient=redis.createClient(process.env.REDIS_URL);

  socket.on('join',(roomid,rejoin_id)=>{
    socket.join(roomid);
    //socket.removeAllListeners('start','pull','move','cursor','disconnect','remove-interval');
    console.log('1');
    if(rejoin_id){
      redisClient.get(roomid,(error,value)=>{
        executive_access(socket,redisClient,roomid,rejoin_id);
      })
    }
    else{
      io.to(roomid).clients(function(_, clients){
        if(clients.length==1){
          redisClient.get(roomid,(error,value)=>{
            console.log(JSON.parse(value));
          })
          console.log('1人目');
          roomObject={};
          //初期化
          roomObject.playerid=1;
          roomObject.player_num=1;
          roomObject.winner_num=0;
          console.log('2');
          player=new Player(roomObject.playerid);
          roomObject.player_list={}
          roomObject.player_list[roomObject.playerid]=player;
          roomObject.cursor={
            x:null,
            y:null
          }
          console.log('3');
          redisClient.set(roomid, JSON.stringify(roomObject));
          socket.emit('joined',roomObject.playerid);
        }
        else if(clients.length<=4){
          console.log('2人目以降');
          console.log('------------');
          executive_access(socket,redisClient,roomid);
        }
        else{
          socket.leave(roomid);
          socket.emit('over-notice');
          return;
        }
      });
    }

    //スタート時にリスナーをセット
    console.log('リスナーをセット');
    socket.on('start',(config)=>{
      redisClient.get(roomid,(_, value) =>{
        roomObject=JSON.parse(value);
        playerid=roomObject.playerid;
        player_num=roomObject.player_num;
        winner_num=roomObject.winner_num;
        player_list=roomObject.player_list;
        if(player_num<2){
          io.to(roomid).emit('reject');
          return;
        }
        shuffle_and_distribute(roomObject);
        Object.values(player_list).forEach((player)=>{
          console.log('player Changed');
          player.cardlist=throw_cards(player.cardlist);
        });
        io.to(roomid).emit('distributed',player_list);
    
        for(var i=1;i<=player_num;i++){
          if(i==1){ player_list[i].status='pulled';}
          else if(i==2){ player_list[i].status='pull';}
          else if(i==3){ player_list[i].status='normal1';}//変更
          else{ player_list[i].status='normal2';}
        }
        io.to(roomid).emit('started',player_num);
        socket.on('push',()=>{
          io.sockets.emit('pushed');
        });
        redisClient.set(roomid, JSON.stringify(roomObject));  
      });

      timer=setInterval(()=>{
        redisClient.get(roomid,(error,value)=>{
          roomObject=JSON.parse(value);
          if(roomObject){
            io.to(roomid).emit('location',roomObject.player_list,roomObject.cursor);
          }
        });
      },1000/60);
    });     
    //カードが引かれたとき
    socket.on('pull',(pull_player_id,pulled_card,pulled_card_idx)=>{
      var pulled_player_id;
      console.log('pullされました');

      redisClient.get(roomid,(_,value)=>{
        roomObject=JSON.parse(value);
        playerid=roomObject.playerid;
        player_num=roomObject.player_num;
        winner_num=roomObject.winner_num;
        player_list=roomObject.player_list;
        cursor=roomObject.cursor;
        cursor.x=null;
        cursor.y=null;

        Object.values(player_list).forEach((player)=>{
          if(player.status=='pulled'){
            pulled_player_id=player.id;
          }
        });
        pullcard(player_list[pulled_player_id],pulled_card_idx);
        addcard(player_list[pull_player_id],pulled_card);
        player_list[pull_player_id].cardlist=throw_cards(player_list[pull_player_id].cardlist);
        io.to(roomid).emit('location',player_list,cursor);
        //check and set status winner
        if(player_list[pulled_player_id].cardlist.length==0){
          roomObject.winner_num++;
          player_list[pulled_player_id].status='winner';
          player_list[pulled_player_id].rank=roomObject.winner_num;
        }
        if(player_list[pull_player_id].cardlist.length==0){
          roomObject.winner_num++;
          player_list[pull_player_id].status='winner';
          player_list[pull_player_id].rank=roomObject.winner_num;
        }

        if(roomObject.winner_num<player_num-1){
          var count=0;
          for(var i=0;i<player_num;i++){
            if(player_list[(pulled_player_id+i)%player_num+1].status!='winner'){
              console.log(count);
              if(count==0){
                player_list[(pulled_player_id+i)%player_num+1].status='pulled';
                count++;
              }else if(count==1){
                player_list[(pulled_player_id+i)%player_num+1].status='pull';
                count++;
              }else if(count==2){//変更
                player_list[(pulled_player_id+i)%player_num+1].status='normal1';
                count++;
              }else{
                player_list[(pulled_player_id+i)%player_num+1].status='normal2';
              }
            }
          }
          redisClient.set(roomid, JSON.stringify(roomObject));
        }else{
          for(var i=1;i<=player_num;i++){
            if(player_list[(pulled_player_id+i)%player_num+1].status!='winner'){
              player_list[(pulled_player_id+i)%player_num+1].status='loser';
            }
          }
          io.to(roomid).emit('location',player_list,cursor);
          if(timer){
            clearInterval(timer);
            console.log('インターバルをクリア');
          }
          roomObject.player_list={};
          roomObject.playerid=0;
          roomObject.player_num=0;
          roomObject.winner_num=0;
          redisClient.set(roomid, JSON.stringify(roomObject));
          
          var leaved_socket_list=[];
          Object.values(io.to(roomid).sockets).forEach((socket)=>{
            if(socket.rooms[roomid]){
              socket.removeAllListeners('start');
              socket.removeAllListeners('pull');
              socket.removeAllListeners('move');
              socket.removeAllListeners('cursor');
              socket.removeAllListeners('disconnect');
              socket.removeAllListeners('shot');
              socket.removeAllListeners('card_shotted');
              socket.emit('finish');
              socket.leave(roomid);
              leaved_socket_list.push(socket);
            }
          });
          leaved_socket_list.forEach((socket)=>{
            socket.emit('leaved-after-finish');
          })
        }
        console.log('winner num===='+roomObject.winner_num);
      });
    });
    //カードが動かされたとき
    socket.on('move',(pulled_player_id,moved_card,moved_card_idx)=>{
      redisClient.get(roomid,(_,value)=>{
        roomObject=JSON.parse(value);
        pullcard(roomObject.player_list[pulled_player_id],moved_card_idx);
        addcard(roomObject.player_list[pulled_player_id],moved_card);
        redisClient.set(roomid, JSON.stringify(roomObject));
      });
    });
    //キャンバス上にカーソルがきたとき
    socket.on('cursor',(id,x,y)=>{
      redisClient.get(roomid,(_,value)=>{
        roomObject=JSON.parse(value);
        roomObject.cursor.x=x;
        roomObject.cursor.y=y;
        redisClient.set(roomid,JSON.stringify(roomObject));
      });
    });

    //インクがとばされたとき
    socket.on('shot',(shot_id,shotted_id,x,y)=>{
      io.to(roomid).emit('shotted',shot_id,shotted_id,x,y);
      setTimeout(()=>{ 
        redisClient.get(roomid,(_,value)=>{
          roomObject=JSON.parse(value);
          for (var i=1;i<=Object.keys(roomObject.player_list).length;i++){
            for(var j=0;j<roomObject.player_list[i].cardlist.length;j++){
              if(roomObject.player_list[i].cardlist[j].inkoffset.id==shot_id){
                console.log("はいってるよ");
                roomObject.player_list[i].cardlist[j].inkoffset.x=null;
                roomObject.player_list[i].cardlist[j].inkoffset.y=null;
                roomObject.player_list[i].cardlist[j].inkoffset.id=null;
              }
            }
          }
          redisClient.set(roomid,JSON.stringify(roomObject));
        });
      },20000);
    })

    //インクがカードにかかったとき
    socket.on('card_shotted',(shotted_id,shotted_card_list,shotted_card_idx_list)=>{
      redisClient.get(roomid,(_,value)=>{
        roomObject=JSON.parse(value);
        shotted_card_list.forEach((shotted_card,idx)=>{
          var card_idx=shotted_card_idx_list[idx];
          roomObject.player_list[shotted_id].cardlist[card_idx]=shotted_card;
        })
        redisClient.set(roomid,JSON.stringify(roomObject));
      });
    })

    socket.on('disconnect',()=>{
      if(timer){
        clearInterval(timer);
        console.log('インターバルをクリア');
      }
      redisClient.del(roomid);

      var leaved_socket_list=[]
      Object.values(io.to(roomid).sockets).forEach((socket)=>{
        console.log("removeする？");
        if(socket.rooms[roomid]){
          console.log("yes");
          socket.removeAllListeners('start');
          socket.removeAllListeners('pull');
          socket.removeAllListeners('move');
          socket.removeAllListeners('cursor');
          socket.removeAllListeners('shot');
          socket.removeAllListeners('card_shotted');
          socket.removeAllListeners('disconnect');
          socket.emit('disconnected');
          socket.leave(roomid);
          leaved_socket_list.push(socket);
        }
      });
      leaved_socket_list.forEach((socket)=>{
        socket.emit('leaved-after-disconnect');
      })
      socket.removeAllListeners('remove-interval');
      console.log('disconnected');
    });
    socket.on('remove-interval',()=>{
      if(timer){
        clearInterval(timer);
        console.log('インターバルをクリア');
      }
      socket.removeAllListeners('remove-interval');
    })
  });
});

app.use('/static', express.static(__dirname + '/static'));
app.use('/skyway', express.static(__dirname + '/skyway'));
app.use('/mmd', express.static(__dirname + '/mmd'));

app.get('/', (req, res) => {
  res.setHeader( 'Access-Control-Allow-Origin', '*' );
  res.sendFile(path.join(__dirname, '/static/index.html'));
});

app.post('/', (req,res)=>{
  console.log(req.headers);
})

var getInformations = function(request){
	return {
		'リクエスト情報':{
			'データ送信':request.method,
			'ホスト（ヘッダー情報）':request.headers['host'],
			'コネクション（ヘッダー情報）':request.headers['connection'],
			'キャッシュコントロール（ヘッダー情報）':request.headers['cache-control'],
			'アクセプト（ヘッダー情報）':request.headers['accept'],
			'アップグレードリクエスト（ヘッダー情報）':request.headers['upgrade-insecure-requests'],
			'ユーザーエージェント（ヘッダー情報）':request.headers['user-agent'],
			'エンコード（ヘッダー情報）':request.headers['accept-encoding'],
			'言語（ヘッダー情報）':request.headers['accept-language'],
		}
	};
};

server.listen(process.env.PORT || 3000, () => {
    console.log("Starting server on port"+port);
});