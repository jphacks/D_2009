let scene, renderer, camera, mesh, helper;

let ready = false;

//browser size
const windowWidth = window.innerWidth;
const windowHeight = window.innerHeight;

//Obujet Clock
const clock = new THREE.Clock();


const Pmx = "/mmd/pmx/Miraikomachi_addSemiBone.pmx";
const MotionObjects = [
  { id: "loop", VmdClip: null, AudioClip: false },
];

function start_mmd(){
  Init();
  LoadModeler();
}

/*
 * Initialize Three
 * camera and right
 */
(Init = () => {
  scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0xeeeeee);
  scene.add(ambient);
  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#mmd-model'),
    alpha: true 
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth*0.9, window.innerHeight*0.9);
  renderer.setClearColor(0xcccccc, 0);
})

/*
 * Load PMX and VMD and Audio
 */
(LoadModeler = async () => {
  const loader = new THREE.MMDLoader();

  //Loading PMX
  LoadPMX = () => {
    return new Promise(resolve => {
      loader.load(Pmx, (object) => {
        mesh = object;
        scene.add(mesh);

        resolve(true);
      }, onProgress, onError);
    });
  }

  //Loading VMD
  LoadVMD = (id) => {
    return new Promise(resolve => {
      const path = "/mmd/vmd/" + id + ".vmd";
      const val = MotionObjects.findIndex(MotionObject => MotionObject.id == id);

      loader.loadAnimation(path, mesh, (vmd) => {
        vmd.name = id;

        MotionObjects[val].VmdClip = vmd;

        resolve(true);
      }, onProgress, onError);
    });
  }

  //Load Audio
  LoadAudio = (id) => {
    return new Promise(resolve => {
      const path = "/mmd/audio/" + id + ".mp3";
      const val = MotionObjects.findIndex(MotionObject => MotionObject.id == id);

      if (MotionObjects[val].AudioClip) {
        new THREE.AudioLoader().load(path, (buffer) => {
          const listener = new THREE.AudioListener();
          const audio = new THREE.Audio(listener).setBuffer(buffer);
          MotionObjects[val].AudioClip = audio;

          resolve(true);
        }, onProgress, onError);
      } else {
        resolve(false);
      }
    });
  }

  // Loading PMX...
  await LoadPMX();

  // Loading VMD...
  await Promise.all(MotionObjects.map(async (MotionObject) => {
    return await LoadVMD(MotionObject.id);
  }));

  // Loading Audio...
  await Promise.all(MotionObjects.map(async (MotionObject) => {
    return await LoadAudio(MotionObject.id);
  }));
})

/*
 * Start Vmd and Audio.
 * And, Get Vmd Loop Event
 */
VmdControl = (id, loop,direction) => {
  console.log("vmd");
  mmdcanvas=document.querySelector('#mmd-model');
  mmdcanvas.style.zIndex=3;
  //cameraの作成
  var rightLeft=50;
  var frontBehind=40;
  switch (direction) {
    case 1:
      rightLeft=-rightLeft;
      break;
    case 2:
      break;
    case 3:
      rightLeft=-rightLeft;
      frontBehind=-frontBehind;
      break;
    case 4:
      frontBehind=-frontBehind;
      break;
    default:
      console.log("cannot specify direction");
      break;
  }

  camera = new THREE.PerspectiveCamera(50, windowWidth / windowHeight, 1, 1000);
  camera.position.set(-rightLeft, 11, -frontBehind);
  camera.lookAt(new THREE.Vector3(rightLeft, 0, frontBehind));

  scene.add(mesh);
  Render();
  const index = MotionObjects.findIndex(MotionObject => MotionObject.id == id);

  // Not Found id
  if (index === -1) {
    console.log("not Found ID");
    return;
  }

  ready = false;
  helper = new THREE.MMDAnimationHelper({ afterglow: 2.0, resetPhysicsOnLoop: true });

  // 
  helper.add(mesh, {
    animation: MotionObjects[index].VmdClip,
    physics: false
  });

  //Start Audio
  if (MotionObjects[index].AudioClip) {
    MotionObjects[index].AudioClip.play();
  }

  const mixer = helper.objects.get(mesh).mixer;
  //animation Loop Once
  if (!loop) {
    mixer.existingAction(MotionObjects[index].VmdClip).setLoop(THREE.LoopOnce);
  }

  // VMD Loop Once Event
  mixer.addEventListener("finished", (event) => {
    console.log("finished");
    scene.remove(scene.children[1]);
    mmdcanvas.style.zIndex=0;
  });

  ready = true;
}


/*
 * Loading PMX or VMD or Voice
 */
onProgress = (xhr) => {
  if (xhr.lengthComputable) {
    const percentComplete = xhr.loaded / xhr.total * 100;
    console.log(Math.round(percentComplete, 2) + '% downloaded');
  }
}

/* 
 * loading error
 */
onError = (xhr) => {
  console.log("ERROR");
}

/*
 * MMD Model Render
 */
(Render = () => {
  requestAnimationFrame(Render);
  renderer.clear();
  renderer.render(scene, camera);

  if (ready) {
    helper.update(clock.getDelta());
  }
})
