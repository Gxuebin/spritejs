const container = document.getElementById('paper');
const {Scene, Arc} = spritejs;

const scene = new Scene({
  container,
  displayRatio: 2,
  // contextType: '2d',
});

const layer = scene.layer();
document.querySelector('#paper canvas').style.backgroundColor = '#eee';

const s = new Arc();
s.attr({
  radius: 5,
  fillColor: 'red',
});

const vertex = `
  attribute vec3 a_vertexPosition;
  attribute vec4 a_color;
  varying vec4 vColor;
  attribute vec4 a_transform0;
  attribute vec4 a_transform1;
  attribute vec2 uv;
  varying vec2 vUv;
  
  void transformPoint(inout vec2 p, vec3 m0, vec3 m1, float w, float h) {
    float x = p.x;
    float y = p.y;
    x = (x + 1.0) * 0.5 * w;
    y = (1.0 - y) * 0.5 * h;
    p.x = x * m0.x + y * m0.y + m0.z;
    p.y = x * m1.x + y * m1.y + m1.z;
    p.x = 2.0 * (p.x / w - 0.5);
    p.y = 2.0 * (0.5 - p.y / h);
  }

  highp float random(vec2 co)
  {
      highp float a = 12.9898;
      highp float b = 78.233;
      highp float c = 43758.5453;
      highp float dt= dot(co.xy ,vec2(a,b));
      highp float sn= mod(dt,3.14);
      return fract(sin(sn) * c);
  }

  varying float randomDelay;

  void main() {
    gl_PointSize = 1.0;

    vec3 m0 = vec3(a_transform0.x, a_transform0.z, a_transform1.y);
    vec3 m1 = vec3(a_transform0.y, a_transform1.x, a_transform1.z);

    randomDelay = random(vec2(a_transform0.z, a_transform1.z));

    vec2 xy = a_vertexPosition.xy;
    transformPoint(xy, m0, m1, a_transform0.w, a_transform1.w);
    gl_Position = vec4(xy, 1.0, 1.0);

    vColor = a_color;
    vUv = uv;
  }
`;

const fragment = `
  precision mediump float;
  varying vec4 vColor;
  varying vec2 vUv;
  uniform float u_time;
  varying float randomDelay;
  #define TAU 6.28

  void main() {
    float d = 2.0 * distance(vUv, vec2(0.5));
    float time = u_time + randomDelay;
    float r = mix(0.0, 0.5, 0.5 + 0.5 * sin(5.0 * time));
    gl_FragColor.rgb = vColor.rgb * step(r, 1.0 - d);
    gl_FragColor.a = d * step(r, 1.0 - d);
  }
`;

const program = layer.renderer.createProgram({vertex, fragment});

const count = 50000;

const cloud = new spritejs.Cloud(s, count, {buffer: count});
cloud.setProgram(program);

cloud.setUniforms({
  u_time: 0,
});
layer.append(cloud);

const {width, height} = layer.getResolution();

for(let i = 0; i < count; i++) {
  // 模拟随机位置
  cloud.translate(i, [Math.random() * width, Math.random() * height]);
}

layer.tick((t) => {
  cloud.setUniforms({
    u_time: t / 1000,
  });
});