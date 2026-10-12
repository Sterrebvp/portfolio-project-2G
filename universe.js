(() => {
  const root = document.querySelector('.universe');
  if (!root) return;
  const canvas = root.querySelector('canvas');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const work = document.querySelector('#work');
  const introDetails = document.querySelector('.hero-details');
  const header = document.querySelector('.portfolio-nav');
  const skip = document.querySelector('.skip');
  const footerIntroLinks = document.querySelectorAll('footer a[href="#intro"]');
  const pageContent = [...document.querySelectorAll('main > :not(.universe), footer')];
  const deepLink = location.hash && location.hash !== '#home'
    ? document.getElementById(location.hash.slice(1))
    : null;
  let state = deepLink ? 'portfolio' : 'intro';
  let gl;
  try { gl = canvas.getContext('webgl', {alpha:false, antialias:false, powerPreference:'low-power'}); } catch (_) {}
  let paused = reduce.matches, visible = true, raf = 0, previous = 0, time = 0, flight = 0, timer;
  const mouse = [0,0], target = [0,0];
  const explore = root.querySelector('[data-explore]');
  const scrollKeys = new Set([' ', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp']);
  const preventScroll = event => event.preventDefault();
  const blockScrollKeys = event => {
    if (state !== 'portfolio' && scrollKeys.has(event.key)) event.preventDefault();
  };
  const trapFocus = event => {
    if (state !== 'portfolio' && !root.contains(event.target)) explore.focus({preventScroll:true});
  };
  const lockPage = () => {
    document.documentElement.classList.add('universe-opening');
    root.hidden = false;
    root.inert = false;
    header.hidden = true;
    header.inert = true;
    skip.inert = true;
    pageContent.forEach(element => { element.inert = true; });
    window.addEventListener('wheel', preventScroll, {passive:false});
    window.addEventListener('touchmove', preventScroll, {passive:false});
    window.addEventListener('keydown', blockScrollKeys, true);
    document.addEventListener('focusin', trapFocus, true);
  };
  const showPortfolio = () => {
    state = 'portfolio';
    document.documentElement.classList.remove('universe-opening');
    root.hidden = true;
    root.inert = true;
    header.hidden = false;
    header.inert = false;
    skip.inert = false;
    pageContent.forEach(element => { element.inert = false; });
    window.removeEventListener('wheel', preventScroll);
    window.removeEventListener('touchmove', preventScroll);
    window.removeEventListener('keydown', blockScrollKeys, true);
    document.removeEventListener('focusin', trapFocus, true);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const finish = () => {
    if (state !== 'transition') return;
    clearTimeout(timer);
    flight = 0;
    root.classList.remove('is-travelling','is-fading');
    showPortfolio();
    history.replaceState(null,'','#work');
    const old = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior='auto';
    introDetails.scrollIntoView({behavior:'instant',block:'start'});
    document.documentElement.style.scrollBehavior=old;
    const heading=work.querySelector('h2');
    heading.setAttribute('tabindex','-1'); heading.focus({preventScroll:true});
  };
  const enterIntro = () => {
    clearTimeout(timer);
    state = 'intro';
    flight = 0;
    time = 0;
    mouse.fill(0);
    target.fill(0);
    root.classList.remove('is-travelling','is-fading');
    lockPage();
    history.replaceState(null,'','#home');
    window.scrollTo({top:0,behavior:'instant'});
    visible = true;
    if (gl) render();
    start();
    explore.focus({preventScroll:true});
  };
  if (state === 'intro') {
    lockPage();
    explore.focus({preventScroll:true});
  } else {
    showPortfolio();
    if (deepLink) requestAnimationFrame(() => deepLink.scrollIntoView({block:'start'}));
  }
  explore.addEventListener('click',e => {
    e.preventDefault();
    if (state !== 'intro') return;
    state = 'transition';
    lockPage();
    if (reduce.matches) {
      finish();
      return;
    }
    flight = 0;
    root.classList.add('is-travelling');
    timer = setTimeout(finish, 2100);
    if (gl) start();
  });
  header.querySelector('.brand').addEventListener('click',event => {
    event.preventDefault();
    enterIntro();
  });
  footerIntroLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    if (location.hash !== '#intro') history.pushState(null, '', '#intro');
    introDetails.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  root.addEventListener('pointermove',e=>{ const r=root.getBoundingClientRect();target[0]=(e.clientX-r.left)/r.width-.5;target[1]=.5-(e.clientY-r.top)/r.height; });
  root.addEventListener('pointerleave',()=>target.fill(0));
  reduce.addEventListener('change',()=>{paused=reduce.matches;if(paused&&state==='transition')finish();start();});
  if(!gl){canvas.hidden=true;return;}
  const vertex=`attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment=`precision highp float;
  uniform vec2 resolution;uniform vec2 pointer;uniform float time;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+7.1;a*=.5;}return s;}
  void main(){vec2 uv=gl_FragCoord.xy/resolution;vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.);p+=pointer*.018;
  vec2 q=p*3.+vec2(time*.006,0.);float n=fbm(q+fbm(q+3.));float ridge=exp(-pow((p.y-p.x*.32+.05)*3.2,2.));float clouds=pow(n,2.1)*ridge;
  float dust=fbm(q*2.7+9.);vec3 col=vec3(.006,.009,.021);col+=mix(vec3(.045,.09,.17),vec3(.23,.10,.29),smoothstep(.2,.8,n))*clouds*1.7;
  col+=vec3(.16,.17,.24)*pow(n,5.)*ridge;col*=1.-.7*smoothstep(.43,.65,dust)*ridge;
  col*=1.-.32*length(uv-.5);gl_FragColor=vec4(col,1.);}`;
  const starsVertex=`attribute vec4 star;uniform float time;uniform float travel;uniform vec2 pointer;uniform float aspect;uniform float dpr;varying float brightness;varying float tint;
  void main(){float z=1.+mod(star.z-time*.015-travel,9.);vec2 p=(star.xy-pointer*.16)/z;gl_Position=vec4(p.x/aspect,p.y,0.,1.);gl_PointSize=min(5.,(.7+star.w*1.8)/sqrt(z)*2.)*dpr;brightness=(.25+star.w*.75)*min(1.,z*.7);tint=star.w;}`;
  const starsFragment=`precision mediump float;varying float brightness;varying float tint;void main(){float d=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.25,1.,d))*brightness;gl_FragColor=vec4(mix(vec3(.63,.72,1.),vec3(1.,.94,.88),tint),a);}`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  function program(v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('WebGL link failed');return p;}
  let nebula,stars;
  try{nebula=program(vertex,fragment);stars=program(starsVertex,starsFragment);}catch(error){console.warn('Universe fallback:',error);gl=null;canvas.hidden=true;return;}
  const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const count=innerWidth<600?2400:5500, data=new Float32Array(count*4);
  let seed=1729;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){data.set([(rand()-.5)*36,(rand()-.5)*22,rand()*9,Math.pow(rand(),3)],i*4);}
  const points=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,points);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  function uniform(p,name,...v){const l=gl.getUniformLocation(p,name);v.length===2?gl.uniform2f(l,...v):gl.uniform1f(l,v[0]);}
  function render(){
    const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(root.clientWidth*dpr),h=Math.round(root.clientHeight*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.useProgram(nebula);gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    let a=gl.getAttribLocation(nebula,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    uniform(nebula,'resolution',w,h);uniform(nebula,'pointer',...mouse);uniform(nebula,'time',time);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(a);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.useProgram(stars);gl.bindBuffer(gl.ARRAY_BUFFER,points);
    a=gl.getAttribLocation(stars,'star');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,0,0);
    uniform(stars,'time',time);uniform(stars,'travel',flight*flight*flight*2.);uniform(stars,'pointer',...mouse);uniform(stars,'aspect',w/h);uniform(stars,'dpr',dpr);gl.drawArrays(gl.POINTS,0,count);gl.disableVertexAttribArray(a);
  }
  function frame(now){raf=0;const dt=Math.min((now-previous)/1000||0,.05);previous=now;
    if(!paused){time+=dt;mouse.forEach((v,i)=>mouse[i]+=(target[i]-v)*.025);if(state==='transition'){flight+=dt;if(flight>1.45)root.classList.add('is-fading');}}
    render();if(!paused&&visible&&!document.hidden&&state!=='portfolio')raf=requestAnimationFrame(frame);
  }
  function start(){if(!gl||raf||state==='portfolio')return;previous=performance.now();raf=requestAnimationFrame(frame);}
  new IntersectionObserver(entries=>{visible=state!=='portfolio'&&entries[0].isIntersecting;if(visible)start();else if(raf){cancelAnimationFrame(raf);raf=0;}},{threshold:0}).observe(root);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else start();});
  window.addEventListener('resize',start);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);gl=null;canvas.hidden=true;if(state==='transition')finish();});
  if(state==='intro')render();
  start();
})();
