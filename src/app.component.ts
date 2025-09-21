import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MathGameService, Operation, Problem } from './math-game.service';

type GameState = 'menu' | 'challengeMenu' | 'playing' | 'gameOver' | 'highScores';
type GameMode = 'classic' | 'challenge';
type FeedbackType = 'success' | 'error' | 'info' | null;

type ModeScores = {
  [key in Operation]?: number[];
};

interface AllHighScores {
  classic: ModeScores;
  challenge: ModeScores;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: [`
    /* Hide number input arrows */
    input[type=number]::-webkit-inner-spin-button, 
    input[type=number]::-webkit-outer-spin-button { 
      -webkit-appearance: none; 
      margin: 0; 
    }
    input[type=number] {
      -moz-appearance: textfield;
    }

    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pop-in {
      0% { opacity: 0; transform: scale(0.8); }
      80% { opacity: 1; transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }

    .animate-fade-in {
      animation: fade-in 0.5s ease-out forwards;
    }
    .animate-pop-in {
      animation: pop-in 0.3s ease-out forwards;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class AppComponent implements OnInit {
  @ViewChild('levelUpAudio') levelUpAudio!: ElementRef<HTMLAudioElement>;

  gameState = signal<GameState>('menu');
  gameMode = signal<GameMode>('classic');
  level = signal(1);
  lives = signal(3);
  score = signal(0);
  scoreInLevel = signal(0);
  
  currentOperation = signal<Operation>('add');
  currentProblem = signal<Problem | null>(null);
  userAnswer = signal('');
  userFactor1 = signal('');
  userFactor2 = signal('');

  feedbackMessage = signal('');
  feedbackType = signal<FeedbackType>(null);
  
  highScores = signal<AllHighScores>({ classic: {}, challenge: {} });
  highScoreTab = signal<GameMode>('classic');
  isNewHighScore = signal(false);

  private timerInterval: ReturnType<typeof setInterval> | null = null;
  timerValue = signal(0);
  initialTimerValue = signal(10);


  readonly POINTS_TO_LEVEL_UP = 5;
  private readonly HIGH_SCORES_KEY = 'mathAdventureAllHighScores';

  levelProgress = computed(() => {
    return (this.scoreInLevel() / this.POINTS_TO_LEVEL_UP) * 100;
  });

  timerProgress = computed(() => {
    if (this.initialTimerValue() === 0) return 0;
    return (this.timerValue() / this.initialTimerValue()) * 100;
  });

  highScoresForDisplay = computed(() => {
    const tab = this.highScoreTab();
    const scores = this.highScores()[tab];
    return (Object.keys(scores) as Operation[]).map(op => ({
      operation: op,
      name: this.getOperationName(op),
      scores: scores[op]?.sort((a, b) => b - a) ?? []
    })).filter(item => item.scores.length > 0);
  });

  private readonly motivationalMessages = [
    '¡Increíble!', '¡Eres una estrella de las mates!', '¡Genial! ¡A por la siguiente!', '¡Fantástico trabajo!', '¡Lo hiciste perfecto!',
  ];
  private readonly errorMessages = [
    '¡Casi! Revisa los números otra vez.', 'No es correcto, ¡pero no te rindas!', '¡Uy! Intenta con otra respuesta.', 'Sigue intentando, ¡aprender es parte del juego!',
  ];

  constructor(private mathService: MathGameService) {}

  ngOnInit() {
    this.loadHighScores();
  }

  selectOperationAndStart(op: Operation) {
    this.currentOperation.set(op);
    this.gameMode.set('classic');
    this.resetGame();
    this.gameState.set('playing');
    this.newProblem();
  }

  startChallenge(op: Operation) {
    this.currentOperation.set(op);
    this.gameMode.set('challenge');
    this.resetGame();
    this.gameState.set('playing');
    this.newProblem();
  }
  
  showChallengeMenu() {
    this.gameState.set('challengeMenu');
  }

  newProblem() {
    this.userAnswer.set('');
    this.userFactor1.set('');
    this.userFactor2.set('');
    this.feedbackMessage.set('');
    this.feedbackType.set(null);
    
    let operationForProblem: Operation = this.currentOperation();
    if (operationForProblem === 'random') {
        const basicOps: Exclude<Operation, 'factor' | 'random'>[] = ['add', 'subtract', 'multiply', 'divide'];
        operationForProblem = basicOps[Math.floor(Math.random() * basicOps.length)];
    }

    const problem = this.mathService.generateProblem(this.level(), operationForProblem);
    this.currentProblem.set(problem);
    if (this.gameMode() === 'challenge') {
      this.startTimer();
    }
  }

  submitAnswer() {
    this.clearTimer();
    const problem = this.currentProblem();
    if (!problem) return;

    const answer = problem.type === 'factor' 
        ? { factor1: this.userFactor1(), factor2: this.userFactor2() } 
        : this.userAnswer();
    
    // Ignore empty submissions
    if (problem.type !== 'factor' && answer === '') return;
    if (problem.type === 'factor' && (this.userFactor1() === '' || this.userFactor2() === '')) return;

    if (this.mathService.checkAnswer(problem, answer)) {
      this.handleCorrectAnswer();
    } else {
      this.handleIncorrectAnswer();
    }
  }

  private handleCorrectAnswer() {
    this.score.update(s => s + 10 * this.level()); // More points for higher levels
    this.scoreInLevel.update(s => s + 1);
    this.feedbackMessage.set(this.getRandomMessage(this.motivationalMessages));
    this.feedbackType.set('success');

    if (this.scoreInLevel() >= this.POINTS_TO_LEVEL_UP) {
      this.levelUp();
    }

    setTimeout(() => this.newProblem(), 1200);
  }

  private handleIncorrectAnswer() {
    this.lives.update(l => l - 1);
    const problem = this.currentProblem();
    if (problem) {
      let explanation = '';
      switch(problem.type) {
        case 'add':
          explanation = `Recuerda, sumar es juntar. La respuesta correcta de ${problem.num1} + ${problem.num2} es ${problem.answer}. ¡Tú puedes!`;
          break;
        case 'subtract':
          explanation = `Para restar ${problem.num1} - ${problem.num2}, quitamos el segundo número al primero. La respuesta es ${problem.answer}. ¡Sigue intentando!`;
          break;
        case 'multiply':
          explanation = `Multiplicar ${problem.num1} × ${problem.num2} es como sumar ${problem.num1} un total de ${problem.num2} veces. El resultado es ${problem.answer}. ¡Ya casi lo tienes!`;
          break;
        case 'divide':
          explanation = `Dividir ${problem.num1} ÷ ${problem.num2} es buscar cuántas veces cabe el ${problem.num2} en el ${problem.num1}. La respuesta es ${problem.answer}, ¡porque ${problem.answer} × ${problem.num2} = ${problem.num1}!`;
          break;
        default:
          explanation = this.getRandomMessage(this.errorMessages);
      }
      this.feedbackMessage.set(explanation);
    } else {
      this.feedbackMessage.set(this.getRandomMessage(this.errorMessages));
    }
    
    this.feedbackType.set('error');
    if (this.lives() <= 0) {
      this.gameOver();
    } else {
      setTimeout(() => this.newProblem(), 3500); // Longer delay to read explanation
    }
  }

  private levelUp() {
    this.level.update(l => l + 1);
    this.scoreInLevel.set(0);
    this.lives.set(3); // Reset lives on level up
    this.feedbackMessage.set(`¡Felicidades! ¡Nivel ${this.level()}!`);
    this.feedbackType.set('info');
    this.levelUpAudio.nativeElement.play();
  }

  gameOver() {
    this.clearTimer();
    this.updateHighScores();
    this.gameState.set('gameOver');
  }

  playAgain() {
    if (this.gameMode() === 'classic') {
      this.selectOperationAndStart(this.currentOperation());
    } else {
      this.startChallenge(this.currentOperation());
    }
  }

  goToMenu() {
    this.clearTimer();
    this.resetGame();
    this.gameState.set('menu');
  }

  viewHighScores() {
    this.gameState.set('highScores');
  }

  private resetGame() {
    this.level.set(1);
    this.lives.set(3);
    this.score.set(0);
    this.scoreInLevel.set(0);
    this.isNewHighScore.set(false);
  }

  private getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private loadHighScores() {
    try {
      const scores = localStorage.getItem(this.HIGH_SCORES_KEY);
      if (scores) {
        const parsed = JSON.parse(scores);
        this.highScores.set({
          classic: parsed.classic ?? {},
          challenge: parsed.challenge ?? {},
        });
      }
    } catch (e) {
      console.error('Error loading high scores', e);
    }
  }
  
  private saveHighScores() {
    try {
      localStorage.setItem(this.HIGH_SCORES_KEY, JSON.stringify(this.highScores()));
    } catch (e) {
      console.error('Error saving high scores', e);
    }
  }
  
  private updateHighScores() {
    const finalScore = this.score();
    if (finalScore === 0) return;

    const operation = this.currentOperation();
    const mode = this.gameMode();

    this.highScores.update(allScores => {
        const currentModeScores = allScores[mode][operation] ?? [];
        
        if (currentModeScores.length < 5 || finalScore > Math.min(...currentModeScores)) {
            const newHighScoresForOperation = [...currentModeScores, finalScore]
              .sort((a, b) => b - a)
              .slice(0, 5);
            
            this.isNewHighScore.set(true);

            return {
                ...allScores,
                [mode]: {
                    ...allScores[mode],
                    [operation]: newHighScoresForOperation
                }
            };
        }
        return allScores;
    });

    if (this.isNewHighScore()) {
      this.saveHighScores();
    }
  }
  
  private startTimer() {
    this.clearTimer();
    const duration = Math.max(5, 12 - Math.floor(this.level() / 2));
    this.initialTimerValue.set(duration);
    this.timerValue.set(duration);
    this.timerInterval = setInterval(() => {
        this.timerValue.update(t => t - 1);
        if (this.timerValue() <= 0) {
            this.handleTimeOut();
        }
    }, 1000);
  }

  private clearTimer() {
      if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
      }
  }

  private handleTimeOut() {
    this.clearTimer();
    this.lives.update(l => l - 1);
    this.feedbackMessage.set('¡Se acabó el tiempo! ¡Más rápido la próxima vez!');
    this.feedbackType.set('error');

    if (this.lives() <= 0) {
        this.gameOver();
    } else {
        setTimeout(() => this.newProblem(), 1500);
    }
  }

  getOperationName(op: Operation): string {
    switch(op) {
      case 'add': return 'Suma';
      case 'subtract': return 'Resta';
      case 'multiply': return 'Multiplicación';
      case 'divide': return 'División';
      case 'factor': return 'Factorización';
      case 'random': return 'Aleatorio';
    }
  }
}