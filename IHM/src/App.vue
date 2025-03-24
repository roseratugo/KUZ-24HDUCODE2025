<script setup>
import { onMounted, nextTick, ref } from "vue";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { TextureLoader } from "three";
import GUI from "lil-gui";

let scene, camera, renderer, model, hotel, clock, mixer, receptionist, receptionistMixer;
let move = { forward: false, backward: false, left: false, right: false };
let velocity = new THREE.Vector3();
const speed = 1.5;
let currentAction = null;
let idleAction = null;
let hotelBoundingBox = null;
let modelBoundingBox = new THREE.Box3();
let additionalLight = null;
const isNearReceptionist = ref(false);
const isInDialogMode = ref(false);
const isLoading = ref(true);
const loadingProgress = ref(0);
const loadingStatus = ref('Initialisation...');
let originalCameraPosition = null;
let originalCameraTarget = null;
let dialogCameraOffset = { x: 0.1, y: 1.8, z: -2.5 };
let dialogCameraFOV = 45;
let gui = null;
let receptionistAudio = null;
let receptionistTalkingAction = null;
let receptionistLoadingAction = null;
let dialogBubble = null;
let isTextScrolling = false;
let textScrollTimeout = null;
let backgroundMusic = null;
const isMusicPlaying = ref(false);

const showInput = ref(false);
const playerInput = ref('');

const chatHistory = ref([]);
const isWaitingForResponse = ref(false);
const currentSessionId = ref(null);

const speechSynthesis = window.speechSynthesis;

const isRecording = ref(false);
const mediaRecorder = ref(null);
const audioChunks = ref([]);

const loadingStates = ref({
  hotel: false,
  character: false,
  receptionist: false,
  animations: false,
  audio: false
});

const generateSpeech = async (text) => {
  try {
    if (receptionistAudio) {
      receptionistAudio.pause();
      receptionistAudio.currentTime = 0;
    }

    const encodedText = encodeURIComponent(text);

    receptionistAudio = new Audio(`http://127.0.0.1:8080/tts?text=${encodedText}`);
    receptionistAudio.volume = 0.7;

    receptionistAudio.addEventListener('play', () => {
      if (receptionistTalkingAction) {
        receptionistTalkingAction.play();
      }
    });

    receptionistAudio.addEventListener('pause', () => {
      if (receptionistTalkingAction) {
        receptionistTalkingAction.stop();
      }
    });

    receptionistAudio.addEventListener('ended', () => {
      if (receptionistTalkingAction) {
        receptionistTalkingAction.stop();
      }
      showInput.value = true;
    });

    return receptionistAudio;
  } catch (error) {
    console.error('Erreur lors de la génération de la voix:', error);
    return null;
  }
};

const isDebugMode = () => {
  return window.location.hash === '#debug';
};

const init = async () => {
  await nextTick();
  const canvas = document.getElementById("threeCanvas");
  if (!canvas) {
    console.error("Canvas non trouvé !");
    return;
  }

  loadingStatus.value = 'Création de la scène...';
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 4.5, 5);
  camera.lookAt(new THREE.Vector3(0, 2, 0));

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.DirectionalLight(0x2342be, 2.5);
  light.position.set(5, 10, 5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040, 2.5));

  const receptionistSpotLight = new THREE.SpotLight(0xffffff, 5);
  receptionistSpotLight.position.set(2.1, 6, 2);
  receptionistSpotLight.angle = Math.PI / 6;
  receptionistSpotLight.penumbra = 0.3;
  receptionistSpotLight.decay = 1;
  receptionistSpotLight.distance = 8;
  receptionistSpotLight.castShadow = true;
  receptionistSpotLight.shadow.mapSize.width = 2048;
  receptionistSpotLight.shadow.mapSize.height = 2048;
  receptionistSpotLight.shadow.camera.near = 0.5;
  receptionistSpotLight.shadow.camera.far = 10;
  receptionistSpotLight.target.position.set(2.1, 0, 2);
  scene.add(receptionistSpotLight);

  additionalLight = new THREE.DirectionalLight(0x2342be, 2.5);
  additionalLight.position.set(-5, 8, -5);
  additionalLight.castShadow = true;
  additionalLight.shadow.mapSize.width = 2048;
  additionalLight.shadow.mapSize.height = 2048;
  additionalLight.shadow.camera.near = 0.5;
  additionalLight.shadow.camera.far = 500;
  additionalLight.shadow.camera.left = -100;
  additionalLight.shadow.camera.right = 100;
  additionalLight.shadow.camera.top = 100;
  additionalLight.shadow.camera.bottom = -100;
  scene.add(additionalLight);

  loadingProgress.value = 10;
  loadingStatus.value = 'Chargement de l\'hôtel...';

  const textureLoader = new TextureLoader();
  const hotelTexture = textureLoader.load("/models/Hallway_Lidar_Model_1_u1_v1_diffuse_8k.png");

  const hotelLoader = new FBXLoader();
  hotelLoader.load("/models/Hotel.fbx", 
    (fbx) => {
      console.log('Hôtel chargé avec succès');
      hotel = fbx;
      hotel.scale.set(0.01, 0.01, 0.01);
      hotel.position.set(-1.8, -0.299999999999999, 3.1);
      hotel.rotation.z = Math.PI;
      scene.add(hotel);

      hotel.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({ map: hotelTexture });
          child.geometry.computeBoundingBox();
        }
      });

      hotelBoundingBox = new THREE.Box3().setFromObject(hotel);

      if (isDebugMode()) {
        gui = new GUI();
        setupGUI();
      }
      loadingProgress.value = 30;
      loadingStatus.value = 'Chargement du personnage...';
      loadingStates.value.hotel = true;
      checkLoadingComplete();
    },
    (progress) => {
      console.log('Progression du chargement de l\'hôtel:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
      console.error('Erreur lors du chargement de l\'hôtel:', error);
      loadingStatus.value = 'Erreur lors du chargement de l\'hôtel';
    }
  );

  const loader = new FBXLoader();
  loader.load("/models/Walking.fbx", 
    (fbx) => {
      console.log('Personnage chargé avec succès');
      model = fbx;
      model.scale.set(0.01, 0.01, 0.01);
      model.position.set(0, 0, 0);
      scene.add(model);

      mixer = new THREE.AnimationMixer(model);
      currentAction = mixer.clipAction(fbx.animations[0]);
      currentAction.stop();

      const idleLoader = new FBXLoader();
      idleLoader.load("/models/Idle.fbx", 
        (idleFbx) => {
          console.log('Animation Idle chargée avec succès');
          idleAction = mixer.clipAction(idleFbx.animations[0]);
          idleAction.play();
          loadingProgress.value = 50;
          loadingStatus.value = 'Chargement du réceptionniste...';
          loadingStates.value.character = true;
          checkLoadingComplete();
        },
        (progress) => {
          console.log('Progression du chargement de l\'animation Idle:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          console.error('Erreur lors du chargement de l\'animation Idle:', error);
          loadingStatus.value = 'Erreur lors du chargement de l\'animation Idle';
        }
      );
    },
    (progress) => {
      console.log('Progression du chargement du personnage:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
      console.error('Erreur lors du chargement du personnage:', error);
      loadingStatus.value = 'Erreur lors du chargement du personnage';
    }
  );

  const receptionistLoader = new FBXLoader();
  receptionistLoader.load("/models/Receptionnist.fbx", 
    (fbx) => {
      console.log('Réceptionniste chargé avec succès');
      receptionist = fbx;
      receptionist.scale.set(0.01, 0.01, 0.01);
      receptionist.position.set(2.1, 0, 2);
      receptionist.rotation.y = -2.34159265358979;
      scene.add(receptionist);

      receptionistMixer = new THREE.AnimationMixer(receptionist);
      const receptionistAction = receptionistMixer.clipAction(fbx.animations[0]);
      receptionistAction.setLoop(THREE.LoopRepeat, Infinity);
      receptionistAction.play();

      const talkingLoader = new FBXLoader();
      talkingLoader.load("/models/Talking.fbx", 
        (talkingFbx) => {
          console.log('Animation Talking chargée avec succès');
          receptionistTalkingAction = receptionistMixer.clipAction(talkingFbx.animations[0]);
          receptionistTalkingAction.setLoop(THREE.LoopRepeat, Infinity);
          receptionistTalkingAction.stop();

          const loadLoader = new FBXLoader();
          loadLoader.load("/models/Load.fbx", 
            (loadFbx) => {
              console.log('Animation Load chargée avec succès');
              receptionistLoadingAction = receptionistMixer.clipAction(loadFbx.animations[0]);
              receptionistLoadingAction.setLoop(THREE.LoopRepeat, Infinity);
              receptionistLoadingAction.stop();

              loadingProgress.value = 75;
              loadingStatus.value = 'Chargement des ressources audio...';
              loadingStates.value.receptionist = true;
              loadingStates.value.animations = true;
              checkLoadingComplete();

              createDialogBubble();

              receptionistAudio = new Audio("/voix/intro.wav");
              receptionistAudio.volume = 0.7;

              receptionistAudio.addEventListener('play', () => {
                if (receptionistTalkingAction) {
                  receptionistTalkingAction.play();
                }
              });

              receptionistAudio.addEventListener('pause', () => {
                if (receptionistTalkingAction) {
                  receptionistTalkingAction.stop();
                }
              });

              receptionistAudio.addEventListener('ended', () => {
                if (receptionistTalkingAction) {
                  receptionistTalkingAction.stop();
                }
                if (dialogBubble) {
                  dialogBubble.visible = false;
                }
                showInput.value = true;
              });

              loadingStates.value.audio = true;
              checkLoadingComplete();
            },
            (progress) => {
              console.log('Progression du chargement de l\'animation Load:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
              console.error('Erreur lors du chargement de l\'animation Load:', error);
              loadingStatus.value = 'Erreur lors du chargement de l\'animation Load';
            }
          );
        },
        (progress) => {
          console.log('Progression du chargement de l\'animation Talking:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          console.error('Erreur lors du chargement de l\'animation Talking:', error);
          loadingStatus.value = 'Erreur lors du chargement de l\'animation Talking';
        }
      );
    },
    (progress) => {
      console.log('Progression du chargement du réceptionniste:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
      console.error('Erreur lors du chargement du réceptionniste:', error);
      loadingStatus.value = 'Erreur lors du chargement du réceptionniste';
    }
  );

  clock = new THREE.Clock();
  animate();
};

const checkLoadingComplete = () => {
  const allLoaded = Object.values(loadingStates.value).every(state => state === true);
  if (allLoaded) {
    loadingProgress.value = 100;
    loadingStatus.value = 'Chargement terminé';
    setTimeout(() => {
      isLoading.value = false;
      if (!backgroundMusic) {
        backgroundMusic = new Audio("/sonor.mp3");
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.05;
        
        backgroundMusic.addEventListener('canplaythrough', () => {
          backgroundMusic.play().then(() => {
            isMusicPlaying.value = true;
          }).catch(error => {
            console.error("Erreur lors de la lecture automatique:", error);
            isMusicPlaying.value = false;
          });
        });
      }
    }, 500);
  }
};

const setupGUI = () => {
  if (!gui) return;

  const lightFolder = gui.addFolder("Lumière Directionnelle");
  
  lightFolder.add(additionalLight.position, "x", -50, 50, 0.1).name("Position X");
  lightFolder.add(additionalLight.position, "y", -50, 50, 0.1).name("Position Y");
  lightFolder.add(additionalLight.position, "z", -500, 500, 0.1).name("Position Z");
  
  lightFolder.add(additionalLight, "intensity", 0, 10, 0.1).name("Intensité");
  lightFolder.addColor({ color: "#ffffff" }, "color").name("Couleur").onChange((value) => {
    additionalLight.color.set(value);
  });
  
  lightFolder.add(additionalLight, "castShadow").name("Projeter des ombres");
  lightFolder.add(additionalLight.shadow.camera, "near", 0.1, 100, 0.1).name("Distance min ombre");
  lightFolder.add(additionalLight.shadow.camera, "far", 100, 1000, 10).name("Distance max ombre");
  
  lightFolder.add(additionalLight.shadow.camera, "left", -200, 200, 1).name("Gauche ombre");
  lightFolder.add(additionalLight.shadow.camera, "right", -200, 200, 1).name("Droite ombre");
  lightFolder.add(additionalLight.shadow.camera, "top", -200, 200, 1).name("Haut ombre");
  lightFolder.add(additionalLight.shadow.camera, "bottom", -200, 200, 1).name("Bas ombre");
  
  lightFolder.open();

  const hotelFolder = gui.addFolder("Hôtel Position & Échelle");
  
  hotelFolder.add({ visible: true }, "visible").name("Afficher l'hôtel").onChange((value) => {
    hotel.visible = value;
  });
  
  hotelFolder.add(hotel.position, "x", -10, 10, 0.1).name("Position X");
  hotelFolder.add(hotel.position, "y", -10, 10, 0.1).name("Position Y");
  hotelFolder.add(hotel.position, "z", -10, 10, 0.1).name("Position Z");

  hotelFolder.add(hotel.scale, "x", 0.001, 0.05, 0.001).name("Échelle X");
  hotelFolder.add(hotel.scale, "y", 0.001, 0.05, 0.001).name("Échelle Y");
  hotelFolder.add(hotel.scale, "z", 0.001, 0.05, 0.001).name("Échelle Z");

  hotelFolder.add(hotel.rotation, "y", -Math.PI, Math.PI, 0.01).name("Rotation Y");
  hotelFolder.add(hotel.rotation, "x", -Math.PI, Math.PI, 0.01).name("Rotation X");
  hotelFolder.add(hotel.rotation, "z", -Math.PI, Math.PI, 0.01).name("Rotation Z");

  hotelFolder.open();

  const cameraFolder = gui.addFolder("Caméra");
  cameraFolder.add(camera.position, "x", -20, 20, 0.1).name("Position X");
  cameraFolder.add(camera.position, "y", -20, 20, 0.1).name("Position Y");
  cameraFolder.add(camera.position, "z", -20, 20, 0.1).name("Position Z");

  cameraFolder.add(camera, "fov", 30, 120, 1).name("Zoom (FOV)").onChange(() => {
    camera.updateProjectionMatrix();
  });

  cameraFolder.open();
};

const setupReceptionistGUI = () => {
  if (!gui || !receptionist) return;

  const receptionistFolder = gui.addFolder("Réceptionniste Position & Rotation");
  
  receptionistFolder.add(receptionist.position, "x", -10, 10, 0.1).name("Position X");
  receptionistFolder.add(receptionist.position, "y", -10, 10, 0.1).name("Position Y");
  receptionistFolder.add(receptionist.position, "z", -10, 10, 0.1).name("Position Z");
  
  receptionistFolder.add(receptionist.rotation, "x", -Math.PI, Math.PI, 0.01).name("Rotation X");
  receptionistFolder.add(receptionist.rotation, "y", -Math.PI, Math.PI, 0.01).name("Rotation Y");
  receptionistFolder.add(receptionist.rotation, "z", -Math.PI, Math.PI, 0.01).name("Rotation Z");
  
  receptionistFolder.add(receptionist.scale, "x", 0.001, 0.05, 0.001).name("Échelle X");
  receptionistFolder.add(receptionist.scale, "y", 0.001, 0.05, 0.001).name("Échelle Y");
  receptionistFolder.add(receptionist.scale, "z", 0.001, 0.05, 0.001).name("Échelle Z");

  receptionistFolder.open();
};

const handleKeyDown = (event) => {
  if (isInDialogMode.value) {
    if (event.key === "Escape") {
      exitDialogMode();
    }
    if (event.key === "Enter" && showInput.value) {
      handleSubmit();
    }
    return;
  }

  switch (event.key) {
    case "z": move.forward = true; break;
    case "s": move.backward = true; break;
    case "q": move.left = true; break;
    case "d": move.right = true; break;
    case "e": 
      if (isNearReceptionist.value && !isInDialogMode.value) {
        startDialogWithReceptionist();
      }
      break;
    case "Escape":
      if (isInDialogMode.value) {
        exitDialogMode();
      }
      break;
  }
  updateAnimationState();
};

const handleKeyUp = (event) => {
  if (isInDialogMode.value) {
    return;
  }

  switch (event.key) {
    case "z": move.forward = false; break;
    case "s": move.backward = false; break;
    case "q": move.left = false; break;
    case "d": move.right = false; break;
  }
  updateAnimationState();
};

const updateAnimationState = () => {
  if (!mixer || !currentAction || !idleAction) return;
  const isMoving = move.forward || move.backward || move.left || move.right;
  
  if (isMoving) {
    if (!currentAction.isRunning()) {
      currentAction.play();
      idleAction.stop();
    }
  } else {
    currentAction.stop();
    if (!idleAction.isRunning()) {
      idleAction.play();
    }
  }
};

const checkCollision = (newPosition) => {
  if (!hotelBoundingBox) return false;

  modelBoundingBox.setFromObject(model).expandByScalar(0.1);
  let futureBoundingBox = modelBoundingBox.clone();
  futureBoundingBox.translate(newPosition.clone().sub(model.position));

  if (hotelBoundingBox.containsBox(modelBoundingBox)) return false;

  if (hotelBoundingBox.intersectsBox(futureBoundingBox)) {
    velocity.multiplyScalar(0.3);
    return true;
  }

  return false;
};

const animate = () => {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);
  if (receptionistMixer) receptionistMixer.update(delta);

  if (isInDialogMode.value) {
    updateDialogBubblePosition();
  }

  if (model) {
    velocity.set(0, 0, 0);

    let direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(model.quaternion);

    let newPosition = model.position.clone();
    if (move.forward) newPosition.addScaledVector(direction, speed * delta);
    if (move.backward) newPosition.addScaledVector(direction, -speed * delta);

    if (!checkCollision(newPosition)) {
      model.position.copy(newPosition);
    }

    if (move.left) model.rotation.y += 1.5 * delta;
    if (move.right) model.rotation.y -= 1.5 * delta;

    if (receptionist) {
      const distance = model.position.distanceTo(receptionist.position);
      isNearReceptionist.value = distance < 2;
    }

    if (!isInDialogMode.value) {
      const camTarget = model.position.clone().sub(direction.multiplyScalar(1));
      camTarget.y += 2;
      camera.position.lerp(camTarget, 0.1);
      camera.lookAt(model.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    }
  }

  renderer.render(scene, camera);
};

const startDialogWithReceptionist = async () => {
  try {
    const sessionResponse = await fetch('http://localhost:3067/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!sessionResponse.ok) {
      throw new Error('Erreur lors de la création de la session');
    }

    const sessionData = await sessionResponse.json();
    currentSessionId.value = sessionData.sessionId;
    console.log('Nouvelle session créée:', currentSessionId.value);

    isInDialogMode.value = true;
    originalCameraPosition = camera.position.clone();
    originalCameraTarget = new THREE.Vector3();
    camera.getWorldDirection(originalCameraTarget);

    const receptionistPosition = receptionist.position.clone();
    const offset = new THREE.Vector3(
      dialogCameraOffset.x,
      dialogCameraOffset.y,
      dialogCameraOffset.z
    );
    camera.position.copy(receptionistPosition).add(offset);
    
    const headTarget = receptionistPosition.clone().add(new THREE.Vector3(0, 1.5, 0));
    camera.lookAt(headTarget);

    camera.fov = dialogCameraFOV;
    camera.updateProjectionMatrix();

    if (!dialogBubble) {
      createDialogBubble();
    }

    const initialMessage = "Bonjour jeune étranger, qu'est ce que je peux faire pour toi ?";

    if (dialogBubble) {
      dialogBubble.visible = true;
      updateDialogBubble(initialMessage);
      updateDialogBubblePosition();
    }

    const audioElement = await generateSpeech(initialMessage);
    if (audioElement) {
      audioElement.play().catch(error => {
        console.error("Erreur lors de la lecture de l'audio:", error);
      });
    }
  } catch (error) {
    console.error('Erreur lors du démarrage du dialogue:', error);
    const errorMessage = 'Désolé, une erreur est survenue lors de la création de la session.';
    if (dialogBubble) {
      dialogBubble.visible = true;
      updateDialogBubble(errorMessage);
    }
  }
};

const exitDialogMode = () => {
  isInDialogMode.value = false;
  showInput.value = false;
  isTextScrolling = false;
  if (textScrollTimeout) {
    clearTimeout(textScrollTimeout);
  }
  
  currentSessionId.value = null;
  
  if (originalCameraPosition && originalCameraTarget) {
    camera.position.copy(originalCameraPosition);
    camera.lookAt(originalCameraTarget);
    camera.fov = 75;
    camera.updateProjectionMatrix();
  }

  if (dialogBubble) {
    dialogBubble.visible = false;
  }

  speechSynthesis.cancel();
};

const updateDialogBubblePosition = () => {
  if (dialogBubble && receptionist) {
    const receptionistPosition = receptionist.position.clone();
    dialogBubble.position.copy(receptionistPosition);
    dialogBubble.position.y += 1.5;
    dialogBubble.position.x += 1;
    dialogBubble.material.map.needsUpdate = true;
  }
};

const sendMessage = async (message) => {
  try {
    isWaitingForResponse.value = true;
    
    if (receptionistLoadingAction && receptionistTalkingAction) {
      receptionistTalkingAction.stop();
      receptionistLoadingAction.play();
    }
    
    console.log('Envoi du message à:', 'http://localhost:3067/api/chat');
    
    const response = await fetch('http://localhost:3067/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        message,
        sessionId: currentSessionId.value
      })
    });

    console.log('Statut de la réponse:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Détails de l\'erreur:', errorData);
      throw new Error(`Erreur ${response.status}: ${errorData.message || 'Erreur lors de l\'envoi du message'}`);
    }

    const data = await response.json();
    console.log('Réponse reçue:', data);

    const responseText = data.response || data.message || 'Désolé, je n\'ai pas pu générer une réponse.';

    chatHistory.value.push({
      type: 'user',
      content: message
    });
    
    chatHistory.value.push({
      type: 'assistant',
      content: responseText
    });

    updateDialogBubble(responseText);

    if (receptionistLoadingAction && receptionistTalkingAction) {
      receptionistLoadingAction.stop();
      receptionistTalkingAction.play();
    }

    const audioElement = await generateSpeech(responseText);
    if (audioElement) {
      audioElement.play().catch(error => {
        console.error("Erreur lors de la lecture de l'audio:", error);
      });
    }
  } catch (error) {
    console.error('Erreur détaillée:', error);
    const errorMessage = 'Désolé, une erreur est survenue lors de la communication avec le serveur.';
    
    if (receptionistLoadingAction) {
      receptionistLoadingAction.stop();
    }
    
    chatHistory.value.push({
      type: 'error',
      content: errorMessage
    });
    
    updateDialogBubble(errorMessage);
  } finally {
    isWaitingForResponse.value = false;
  }
};

const createDialogBubble = () => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 256;

  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  
  context.beginPath();
  context.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 8);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true,
    depthTest: false,
    blending: THREE.NormalBlending,
    opacity: 0
  });
  
  dialogBubble = new THREE.Sprite(spriteMaterial);
  dialogBubble.scale.set(1.2, 0.6, 0.6);
  dialogBubble.visible = false;
  
  scene.add(dialogBubble);

  const animate = () => {
    if (!dialogBubble.visible) return;
    
    const time = Date.now() * 0.001;
    const scale = 1 + Math.sin(time * 1.5) * 0.01;
    dialogBubble.scale.set(scale * 1.2, scale * 0.6, scale * 0.6);
    
    requestAnimationFrame(animate);
  };
  
  animate();
};

const updateDialogBubble = (text) => {
  if (!dialogBubble) {
    createDialogBubble();
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  context.font = 'bold 24px Arial';
  const lineHeight = 35;
  const padding = 32;
  const maxWidth = 512 - padding * 2;

  const words = text.split(' ');
  let lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const width = context.measureText(currentLine + ' ' + words[i]).width;
    if (width < maxWidth) {
      currentLine += ' ' + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);

  const totalTextHeight = lines.length * lineHeight;
  const minHeight = 256;
  const calculatedHeight = Math.max(minHeight, totalTextHeight + padding * 2);
  
  canvas.width = 512;
  canvas.height = calculatedHeight;

  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  
  context.beginPath();
  context.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 8);
  context.fill();

  context.font = 'bold 24px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const startY = (canvas.height - totalTextHeight) / 2;
  
  lines.forEach((line, index) => {
    const y = startY + (index * lineHeight) + (lineHeight / 2);
    context.fillText(line, canvas.width / 2, y);
  });
  
  dialogBubble.material.map = new THREE.CanvasTexture(canvas);
  dialogBubble.material.map.needsUpdate = true;

  const scaleY = calculatedHeight / 256;
  dialogBubble.scale.set(1.2, 0.6 * scaleY, 0.6 * scaleY);
  
  dialogBubble.material.opacity = 0;
  const fadeIn = () => {
    dialogBubble.material.opacity += 0.05;
    if (dialogBubble.material.opacity < 1) {
      requestAnimationFrame(fadeIn);
    }
  };
  fadeIn();
  
  dialogBubble.visible = true;
};

const handleSubmit = async () => {
  if (playerInput.value.trim()) {
    const message = playerInput.value.trim();
    await sendMessage(message);
    playerInput.value = '';
    showInput.value = false;
  }
};

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.value = new MediaRecorder(stream);
    audioChunks.value = [];

    mediaRecorder.value.ondataavailable = (event) => {
      audioChunks.value.push(event.data);
    };

    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/wav' });
      await sendAudioToWhisper(audioBlob);
    };

    mediaRecorder.value.start();
    isRecording.value = true;
  } catch (error) {
    console.error('Erreur lors de l\'accès au microphone:', error);
  }
};

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop();
    isRecording.value = false;
  }
};

const sendAudioToWhisper = async (audioBlob) => {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob);

    const response = await fetch('http://127.0.0.1:8080/whisper', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la transcription');
    }

    const data = await response.json();
    if (data.transcription) {
      playerInput.value = data.transcription;
      await sendMessage(data.transcription);
    } else if (data.error) {
      console.error('Erreur de transcription:', data.error);
    }
  } catch (error) {
    console.error('Erreur lors de la transcription:', error);
  }
};

const startBackgroundMusic = () => {
  console.log("Tentative de démarrage de la musique...");
  
  if (!backgroundMusic) {
    console.log("Création d'une nouvelle instance Audio...");
    backgroundMusic = new Audio("/sonor.mp3");
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.05;
    
    backgroundMusic.addEventListener('error', (e) => {
      console.error("Erreur lors du chargement de l'audio:", e);
    });
    
    backgroundMusic.addEventListener('canplaythrough', () => {
      console.log("Audio prêt à être joué");
      backgroundMusic.play().then(() => {
        console.log("Lecture démarrée avec succès");
        isMusicPlaying.value = true;
      }).catch(error => {
        console.error("Erreur lors de la lecture:", error);
      });
    });
  } else {
    console.log("Instance Audio existante, tentative de lecture...");
    backgroundMusic.play().then(() => {
      console.log("Lecture démarrée avec succès");
      isMusicPlaying.value = true;
    }).catch(error => {
      console.error("Erreur lors de la lecture:", error);
    });
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  init();
});
</script>

<template>
  <div class="container">
    <canvas id="threeCanvas"></canvas>
    <div v-if="!isMusicPlaying && !isLoading && backgroundMusic" class="music-start-button" @click="startBackgroundMusic">
      Cliquez pour démarrer la musique
    </div>
    <div v-if="isLoading" class="loader-container">
      <h1 class="loader-title">Spooky California 👻</h1>
      <h2 class="loader-subtitle">Équipe KUZ</h2>
      <div class="loader">
        <div class="loader-bar" :style="{ width: loadingProgress + '%' }"></div>
      </div>
      <div class="loader-text">{{ loadingStatus }}</div>
    </div>
    <div v-if="isNearReceptionist && !isInDialogMode" class="interaction-message">
      Appuyez sur <span class="key">E</span> pour parler avec le réceptionniste
    </div>
    <div v-if="showInput" class="input-container">
      <div class="input-row">
        <input 
          type="text" 
          v-model="playerInput" 
          placeholder="Entrez votre réponse..."
          autofocus
          :disabled="isWaitingForResponse"
        >
        <button 
          class="voice-button"
          :class="{ 'recording': isRecording }"
          @mousedown="startRecording"
          @mouseup="stopRecording"
          @mouseleave="stopRecording"
          :disabled="isWaitingForResponse"
        >
          🎤
        </button>
      </div>
      <div class="input-hint">
        <span v-if="isWaitingForResponse" class="thinking">
          Le réceptionniste réfléchit...
        </span>
        <span v-else>
          Appuyez sur Entrée pour répondre ou maintenez le bouton 🎤 pour parler
        </span>
      </div>
    </div>
  </div>
</template>

<style>
body {
  margin: 0;
  overflow: hidden;
}

.container {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.interaction-message {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  font-size: 16px;
  z-index: 1000;
}

.key {
  background-color: #ffffff;
  color: #000000;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  margin: 0 4px;
}

.input-container {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.input-container input {
  width: 300px;
  padding: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 16px;
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
  outline: none;
  transition: border-color 0.3s ease;
}

.input-container input:focus {
  border-color: rgba(255, 255, 255, 0.5);
}

.input-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-family: Arial, sans-serif;
}

.loader-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  transition: opacity 0.5s ease;
}

.loader-title {
  color: #ffffff;
  font-family: Arial, sans-serif;
  font-size: 48px;
  font-weight: bold;
  margin-bottom: 20px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
}

.loader-subtitle {
  color: #ffffff;
  font-family: Arial, sans-serif;
  font-size: 24px;
  font-weight: normal;
  margin-bottom: 40px;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
  letter-spacing: 1px;
  opacity: 0.8;
}

.loader {
  width: 300px;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 20px;
}

.loader-bar {
  height: 100%;
  background-color: #ffffff;
  transition: width 0.3s ease;
}

.loader-text {
  color: #ffffff;
  font-family: Arial, sans-serif;
  font-size: 16px;
  opacity: 0.8;
}

.thinking {
  color: #ffd700;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.voice-button {
  background-color: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  padding: 12px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.voice-button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.voice-button.recording {
  background-color: rgba(255, 0, 0, 0.3);
  border-color: rgba(255, 0, 0, 0.5);
  animation: pulse 1s infinite;
}

.voice-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.music-start-button {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-family: Arial, sans-serif;
  font-size: 16px;
  z-index: 1000;
  transition: background-color 0.3s ease;
}

.music-start-button:hover {
  background-color: rgba(0, 0, 0, 0.9);
}
</style>
