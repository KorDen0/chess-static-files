const STATIC_PATH = 'https://korden0.github.io/chess-static-files.github.io/chess-game/'


const getStaticUrl = filename => `${STATIC_PATH}${filename}`

class AudioPlayer {
  constructor(audioFilePath) {
      this.audio = new Audio(audioFilePath)
      this.isPlaying = false
      
      this.audio.addEventListener('play', () => {
          this.isPlaying = true
      })

      this.audio.addEventListener('pause', () => {
          this.isPlaying = false
      })
      this.audio.addEventListener('ended', () => {
        this.isPlaying = false
        this.audio.currentTime = 0
        this.play()
    });
  }
  

  async play() {
    if(this.isPlaying) return
    this.audio.volume = +(localStorage.getItem('gameVolume') ?? 0.5)
    this.audio.currentTime = 0
    try {
        if (!this.isPlaying) {
            await this.audio.play();
        }
    } catch (error) {
        console.error('Playback failed:', error);
    }
}

  pause() {
      if (this.isPlaying) {
          this.audio.pause()
          this.isPlaying = false
      }
  }

  setVolume(volume) {
    this.audio.volume = volume
    localStorage.setItem('gameVolume', this.audio.volume)
  }
}

class Enemy{
  constructor({container, speed, target}) {
    this.container = container
    this.speed = speed
    this.collisionDetected = false;
    this.target = target
    this.moveElement = this.moveElement.bind(this);
  }
  setGame(game){
    this.game = game
  }
  start(){
    this.x = 0
    this.y = 0

    this.element = $(`<div class="enemy"><img src="${getStaticUrl('enemy.gif')}"></div>`)

    this.element.css({ left: `${this.x}px`, top: `${this.y}px` })

    this.container.append(this.element)

    this.containerWidth = this.container.width()
    this.containerHeight = this.container.height()

    this.elementWidth = this.element.width()
    this.elementHeight = this.element.height()

    this.bufferZone = 20
    this.collisionDetected = false
    this.angle = Math.random() * 20 + 10

    this.intervalId = setInterval(this.moveElement, 20)

  }
  
  stop() {
    clearInterval(this.intervalId)
  }

  clear(){
    clearInterval(this.intervalId)
    if(this.element) this.element.remove()
  }
  moveElement() {
    if (this.collisionDetected) {
      this.stop()
      return
    }

    this.targets = this.container.find(`[data-piece="${this.target}"]`)

    this.x += this.speed * Math.cos(this.angle * Math.PI / 180)
    this.y += this.speed * Math.sin(this.angle * Math.PI / 180)

    if (this.x <= -this.bufferZone || this.x >= this.containerWidth - this.elementWidth + this.bufferZone) {
      this.angle = Math.random() * 360;
      this.x = Math.max(-this.bufferZone, Math.min(this.containerWidth - this.elementWidth + this.bufferZone, this.x));
    }

    if (this.y <= -this.bufferZone || this.y >= this.containerHeight - this.elementHeight + this.bufferZone) {
      this.angle = Math.random() * 360;
      this.y = Math.max(-this.bufferZone, Math.min(this.containerHeight - this.elementHeight + this.bufferZone, this.y));
    }

    this.element.css({ left: `${this.x}px`, top: `${this.y}px` })

    this.checkCollision()
  }

  checkCollision() {
    const movingRect = this.element[0].getBoundingClientRect();

    this.targets.each((index, element) => {
      const staticRect = element.getBoundingClientRect();
      if (!(movingRect.right < staticRect.left ||
            movingRect.left > staticRect.right ||
            movingRect.bottom < staticRect.top ||
            movingRect.top > staticRect.bottom)) {
        this.collisionDetected = true;
        this.game.finishRound()
        return false
      }
    })
  }
}


var board = null
var game = new Chess()
var whiteSquareGrey = '#a9a9a9'
var blackSquareGrey = '#696969'

class Game{
  constructor({boardId, container}){
    this.boardId = boardId

    this.root = $(container)

    this.container = $(`
      <div class="board-container">
        <div id="board"></div>
        <div class="game-modal">
          <div class="game-modal-block"></div>
        </div>
      </div>
    `)

    this.root.append(this.container)

    this.root.append($(`
      <div class="board-control-container">
        <span>Громкость музыки</span>
        <input class="volume-slider" type="range" min="0" max="1" step="0.01" value="0.5">
      </div>
    `))

    const config = {
      draggable: true,
      pieceTheme: piece => {
        if(piece === 'bP') return getStaticUrl('candy.png')
        return `https://chessboardjs.com/img/chesspieces/wikipedia/${piece}.png`
      },
      onDragStart: this.onDragStart.bind(this),
      onDrop: this.onDrop.bind(this),
      onSnapEnd: this.onSnapEnd.bind(this)
    }


    this.audioPlayer = new AudioPlayer(getStaticUrl('round.mp3'))
    this.board = Chessboard(this.boardId, config)
    this.game = new Chess()

    this.activeChose = false

    this.currentTurn = 0
    this.roundStarted = false
    
    this.root.find('.volume-slider').val(localStorage.getItem('gameVolume') ?? 0.5)
    this.root.find('.volume-slider').on('input', (event) => {
      this.audioPlayer.setVolume(event.target.value)
    })

  }

  showStartmodal(){
    const modalContainer = this.container.find('.game-modal')
    
    const modalContent = modalContainer.find('.game-modal-block')
    modalContent.html(`
      <div>
      <div class="game-modal__title">${this.modalTitle}</div>
      <div class="game-modal__content">
       ${this.modalDesc}
      </div>
      <div class="game-modal__footer">
        <button class="btn start">Начать</button>
      </div>
      </div>
    `)
    
    modalContainer.find('.btn.start').click(() => {
      this.startRound()
    })

    modalContainer.addClass('show')

  }
  setRoundData({title = 'Начать игру', desc = '', playerType, playerCells = '', candyCells = '', createEnemy = false, nextRoundLink = '#', maxTurns = 10}){
    this.modalTitle = title
    this.modalDesc = desc
    this.nextRoundLink = nextRoundLink
    this.playerType = 'w'+playerType

    this.playerCells = playerCells.split(' ').map(c => c.toLowerCase())
    this.candies = candyCells.split(' ').map(c => c.toLowerCase())

    this.maxTurns = maxTurns

    if(createEnemy) {
      this.enemy = new Enemy({
        container: this.container,
        target: this.playerType,
        speed: 1
      })
      this.enemy.setGame(this)
    }
    this.showStartmodal()
  }

  hideModal(){
    this.container.find('.game-modal').removeClass('show')
  }

  startRound(){
    this.hideModal()

    this.game.clear()
    this.board.clear()

    if(this.enemy) this.enemy.clear()

    this.currentTurn = 0

    this.audioPlayer.pause()

    this.playerCells.forEach(p => this.game.put({ type: this.playerType[1].toLowerCase(), color: this.playerType[0].toLowerCase() }, p))

    this.currentCandies = []

    this.candies.forEach(p => {
      this.currentCandies.push(p);
      this.game.put({ type: 'p', color: 'b' }, p);
    })

    this.board.position(this.game.fen(), false)

    this.container.find('.square-55d63').on('click', (event) => {
      if($(event.target).data('piece') === this.playerType) return true
      if(!this.activeChose) return true
      const el = $(event.target).data('square') ? event.target : event.target.closest('[data-square]')
      const pos = $(el).data('square')
      this.onDrop(this.currentPosition, pos)
      this.onSnapEnd()
    })

    this.roundStarted = true
    this.audioPlayer.play()

    if(this.enemy) {
      setTimeout(() => {
        this.enemy.start()
      }, 300)
    }
    
  }

  finishRound(){
    this.roundStarted = false

    if(this.enemy) this.enemy.stop()

    this.audioPlayer.pause()

    let stars
    if(this.currentCandies.length > 0) stars = 0
    else if(this.currentTurn <= this.maxTurns) stars = 3
    else if(this.currentTurn <= (this.maxTurns / 100 * 130)) stars = 2
    else stars = 1
    
    const modalContainer = this.container.find('.game-modal')
    
    const modalContent = modalContainer.find('.game-modal-block')
    modalContent.html(`
      <div>
      <div class="game-modal__content">
        <div class="round-stars-container">
          <img src="${stars > 0 ? getStaticUrl('yellow_star.png') : getStaticUrl('black_star.png')}">
          <img src="${stars > 1 ? getStaticUrl('yellow_star.png') : getStaticUrl('black_star.png')}">
          <img src="${stars > 2 ? getStaticUrl('yellow_star.png') : getStaticUrl('black_star.png')}">
        </div>
         ${stars === 0 ? 'Вы проиграли, попробуйте еще раз': ''}
      </div>
      <div class="game-modal__footer">
        <button class="btn green start">Заново</button>
        <a href="${this.nextRoundLink}">
          <button class="btn">Далее</button>
        </a>
      </div>
      </div>
    `)
    
    modalContainer.find('.btn.start').click(() => {
      this.startRound()
    })

    modalContainer.addClass('show')
  }
  
  onDragStart(source, piece){
    if (piece !== this.playerType || !this.roundStarted) return false
  
    this.activeChose = true
    
    this.currentPosition = source
    
    this.onMouseoverSquare(source, piece)

    return true
  }

  onDrop(source, target) {
    const move = this.game.move({
      from: source,
      to: target,
    })
  
    if (move === null) return 'snapback'
    
    this.currentTurn++
    console.log('currentTurn', this.currentTurn)

    this.checkCandyCollision(target)
  
    this.currentPosition = target
    this.activeChose = false
  
    this.removeSteps()
  }

  onSnapEnd() {
    this.board.position(this.game.fen())
    
    const b = this.board.position()
    
    this.game.clear()
    
    Object.entries(b).forEach(([pos, f]) => {
      const [color, type] = f
      this.game.put({type: type.toLowerCase(), color}, pos);
    })
  }

  onMouseoverSquare (square, piece) {
    const moves = this.game.moves({
      square: square,
      verbose: true
    })
    
    if (moves.length === 0) return
  
    for (var i = 0; i < moves.length; i++) {
      this.drawStep(moves[i].to)
    }
  }
  
  checkCandyCollision(square){
    const index = this.currentCandies.indexOf(square);
    if (index !== -1) {
      this.currentCandies.splice(index, 1)
      if (this.currentCandies.length === 0) {
        this.finishRound()
      }
    }
  }

  drawStep(square) {
    this.container.find(`.square-${square}`).addClass('step')
  }

  removeSteps(){
    this.container.find('.step').removeClass('step')
  }

}



