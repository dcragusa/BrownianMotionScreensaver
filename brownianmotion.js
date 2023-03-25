// calibrated to look good (imo) on 1440p fullscreen
const fillPercent = 12;
const sizeFactor = 12;
const speedFactor = 4;
const ballColour = "rgb(80, 80, 80)";
const largeSizeFactor = 6;
const positionDrawInterval = 5;
const lineColour = "rgb(0, 0, 200)";

const twoPi = 2 * Math.PI

class Vector {

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  sub(vector) {
    // subtract another vector from this vector
    return new Vector(this.x - vector.x, this.y - vector.y);
  }

  mul(scalar) {
    // multiply vector by scalar
    return new Vector(this.x * scalar, this.y * scalar);
  }

  neg() {
    return new Vector(-this.x, -this.y);
  }

  dotProduct(vector) {
    // dot product of vector with another vector
    return (this.x * vector.x) + (this.y * vector.y)
  }

  get magnitude() {
    // vector magnitude
    return Math.sqrt(this.x ** 2 + this.y**2);
  }

  clone() {
    return new Vector(this.x, this.y);
  }

}

class Ball {

  constructor(x, y, r, vx, vy) {
    this.position = new Vector(x, y);
    this.r = r;
    this.velocity = new Vector(vx, vy);
    this.colliding = new Set();
  }

  get mass() {
    return this.r ** 2;
  }

  timeStep() {
    // apply velocity to the ball
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
  }

  checkWallCollision(box_width, box_height) {
    // wall collision logic
    if (this.position.x < this.r) {
      this.position.x = this.r;
      this.velocity.x = -this.velocity.x;
    }
    else if (this.position.x > box_width - this.r) {
      this.position.x = box_width - this.r;
      this.velocity.x = -this.velocity.x;
    }
    if (this.position.y < this.r) {
      this.position.y= this.r;
      this.velocity.y = -this.velocity.y;
    }
    else if (this.position.y > box_height - this.r) {
      this.position.y = box_height - this.r;
      this.velocity.y = -this.velocity.y;
    }
  }

  isColliding(ball) {
    // for two balls to be colliding, the distance between their centres must be less than the sum of their radii
    // avoid expensive square root by squaring both sides instead
    return (this.position.x - ball.position.x)**2 + (this.position.y - ball.position.y)**2 < (this.r + ball.r)**2;
  }

  checkBallCollision(ball) {
    // avoid getting stuck in a loop if balls are within each other
    if (this.isColliding(ball)) {
      if (this.colliding.has(ball)) { return; }

      // see https://en.wikipedia.org/wiki/Elastic_collision, angle-free representation as we are using vectors
      const v1_minus_v2 = this.velocity.sub(ball.velocity);
      const pos1_minus_pos2 = this.position.sub(ball.position);
      const dot_product_1 = v1_minus_v2.dotProduct(pos1_minus_pos2);
      const mass_factor_1 = (2 * ball.mass) / (this.mass + ball.mass)
      const velocity_component_1 = pos1_minus_pos2.mul(dot_product_1 / pos1_minus_pos2.magnitude**2)
      const new_v1 = this.velocity.sub(velocity_component_1.mul(mass_factor_1));

      const v2_minus_v1 = v1_minus_v2.neg();
      const pos2_minus_pos1 = pos1_minus_pos2.neg();
      const dot_product_2 = v2_minus_v1.dotProduct(pos2_minus_pos1);
      const mass_factor_2 = (2 * this.mass) / (this.mass + ball.mass)
      const velocity_component_2 = pos2_minus_pos1.mul(dot_product_2 / pos2_minus_pos1.magnitude**2)
      const new_v2 = ball.velocity.sub(velocity_component_2.mul(mass_factor_2));

      this.velocity = new_v1;
      ball.velocity = new_v2;

      this.colliding.add(ball);
      ball.colliding.add(this);
    }
    else if (this.colliding.has(ball)) {
      this.colliding.delete(ball);
      ball.colliding.delete(this);
    }
  }

}

class Box {

  constructor() {
    this.layer1 = document.getElementById("layer1");
    this.layer1_ctx = this.layer1.getContext("2d");
    this.layer2 = document.getElementById("layer2");
    this.layer2_ctx = this.layer2.getContext("2d");
    this.setup();
  }

  setup() {
    // clear screen
    this.balls = [];
    this.layer1_ctx.clearRect(0, 0, this.layer1.width, this.layer1.height);
    this.layer2_ctx.clearRect(0, 0, this.layer2.width, this.layer2.height);
    // debounce setup until screen has finished resizing
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      // set canvases to the entire window size
      this.layer1.width = window.innerWidth;
      this.layer1.height = window.innerHeight;
      this.layer2.width = window.innerWidth;
      this.layer2.height = window.innerHeight;
      this.frameCount = 0;
      // get a radius that looks good (calibrated for 1440p height)
      this.r = (Math.min(this.layer2.width, this.layer2.height) / 1440) * sizeFactor;
      // add all balls
      this.addBalls(this.r);
    }, 100);
  }

  getRandomSpeed() {
    // return random speed between -speedFactor and speedFactor
    return (Math.random() * 2 * speedFactor) - speedFactor;
  }

  addBalls(r) {
    // place main ball
    this.mainBall = new Ball(this.layer2.width / 2, this.layer2.height / 2, r * largeSizeFactor, 0, 0);
    this.balls.push(this.mainBall);
    this.lastMainBallPosition = this.mainBall.position.clone();
    // go left to right, top to bottom
    for (let y = r; y <= (this.layer2.height - r); y += 2*r) {
      for (let x = r; x <= (this.layer2.width - r); x += 2*r) {
        // place ball according to fill percentage
        if ((Math.random() * 100) > fillPercent) { continue; }
        const ball = new Ball(x, y, r, this.getRandomSpeed(), this.getRandomSpeed());
        // skip if colliding with main ball
        if (ball.isColliding(this.mainBall)) { continue; }
        this.balls.push(ball);
      }
    }
  }

  updateAndDrawPositionHistory() {
    this.layer1_ctx.beginPath();
    this.layer1_ctx.lineWidth = 2;
    this.layer1_ctx.strokeStyle = lineColour;
    this.layer1_ctx.moveTo(this.lastMainBallPosition.x, this.lastMainBallPosition.y);
    this.layer1_ctx.lineTo(this.mainBall.position.x, this.mainBall.position.y);
    this.layer1_ctx.stroke();
    this.lastMainBallPosition = this.mainBall.position.clone();
  }

  drawBalls() {
    this.layer2_ctx.beginPath();
    this.layer2_ctx.fillStyle = ballColour;
    for (const ball of this.balls) {
      // arc() starts at the centre, goes out to the circumference and draws a circle.
      // By starting at the circumference directly, we not only optimise the draw call
      // but also avoid canvas assuming an open path and filling in everything in sight.
      this.layer2_ctx.moveTo(ball.position.x + ball.r, ball.position.y);
      this.layer2_ctx.arc(ball.position.x, ball.position.y, ball.r, 0, twoPi);
    }
    this.layer2_ctx.stroke();
    this.layer2_ctx.fill();
  }

  drawFrame() {
    // update all ball positions
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      ball.timeStep();
      ball.checkWallCollision(this.layer2.width, this.layer2.height);
      for (const other_ball of this.balls.slice(i+1)) {
        ball.checkBallCollision(other_ball);
      }
    }
    // clear ball layer and redraw balls
    this.layer2_ctx.clearRect(0, 0, this.layer2.width, this.layer2.height);
    this.drawBalls();
    // every positionDrawInterval frames, update position history with new main ball position and draw line
    this.frameCount++
    if (this.frameCount === positionDrawInterval) {
      this.frameCount = 0;
      this.updateAndDrawPositionHistory();
    }
  }

}

window.addEventListener("load", async function () {
  let box = new Box();
  window.addEventListener("resize", box.setup.bind(box), false);
  window.setInterval(box.drawFrame.bind(box), 10);
});
