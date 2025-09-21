import { Injectable } from '@angular/core';

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'factor' | 'random';

export interface Problem {
  question: string;
  answer: number | number[];
  type: Operation;
  num1?: number; // Used for non-factorization
  num2?: number; // Used for non-factorization
}

@Injectable({
  providedIn: 'root',
})
export class MathGameService {
  generateProblem(level: number, op: Operation): Problem {
    switch (op) {
      case 'add':
        return this.generateAdditionProblem(level);
      case 'subtract':
        return this.generateSubtractionProblem(level);
      case 'multiply':
        return this.generateMultiplicationProblem(level);
      case 'divide':
        return this.generateDivisionProblem(level);
      case 'factor':
        return this.generateFactorizationProblem(level);
      case 'random':
        // This case will be handled in the component to determine the specific operation for the problem
        // but we need a default or error case here for type safety.
        // The component logic should prevent this from being called with 'random'.
        throw new Error("Cannot generate a problem for 'random' directly. Component should select a specific operation.");
    }
  }

  checkAnswer(problem: Problem, userAnswer: string | {factor1: string, factor2: string}): boolean {
    if (problem.type === 'factor') {
      if (typeof userAnswer !== 'object' || !userAnswer.factor1 || !userAnswer.factor2) {
        return false;
      }
      const f1 = parseInt(userAnswer.factor1, 10);
      const f2 = parseInt(userAnswer.factor2, 10);
      const expectedProduct = (problem.answer as number[])[0] * (problem.answer as number[])[1];
      // Check if user factors multiply to the correct number
      // Also allow factors to be in reverse order
      return f1 * f2 === expectedProduct;
    } else {
        const answer = parseInt(userAnswer as string, 10);
        return answer === problem.answer;
    }
  }

  private generateAdditionProblem(level: number): Problem {
    const max = Math.pow(10, Math.floor((level - 1) / 3) + 1);
    const num1 = this.getRandomInt(1, max);
    const num2 = this.getRandomInt(1, max);
    return {
      question: `${num1} + ${num2} = ?`,
      answer: num1 + num2,
      type: 'add',
      num1,
      num2,
    };
  }

  private generateSubtractionProblem(level: number): Problem {
    const max = Math.pow(10, Math.floor((level - 1) / 3) + 1);
    const num1 = this.getRandomInt(1, max);
    const num2 = this.getRandomInt(1, num1); // ensure no negative results
    return {
      question: `${num1} - ${num2} = ?`,
      answer: num1 - num2,
      type: 'subtract',
      num1,
      num2,
    };
  }

  private generateMultiplicationProblem(level: number): Problem {
    const num1Max = Math.floor(level / 2) + 5;
    const num2Max = Math.floor(level / 3) + 4;
    const num1 = this.getRandomInt(1, num1Max);
    const num2 = this.getRandomInt(1, num2Max);
    return {
      question: `${num1} × ${num2} = ?`,
      answer: num1 * num2,
      type: 'multiply',
      num1,
      num2,
    };
  }

  private generateDivisionProblem(level: number): Problem {
    const answerMax = Math.floor(level / 3) + 5;
    const num2Max = Math.floor(level / 2) + 5;
    const answer = this.getRandomInt(1, answerMax);
    const num2 = this.getRandomInt(1, num2Max);
    const num1 = answer * num2;
    return {
      question: `${num1} ÷ ${num2} = ?`,
      answer: answer,
      type: 'divide',
      num1,
      num2,
    };
  }

    private generateFactorizationProblem(level: number): Problem {
        const maxFactor = Math.floor(level / 2) + 6;
        const factor1 = this.getRandomInt(2, maxFactor);
        const factor2 = this.getRandomInt(2, Math.floor(level / 3) + 5);
        const product = factor1 * factor2;
        return {
        question: `Encuentra dos números que multiplicados den ${product}`,
        answer: [factor1, factor2],
        type: 'factor',
        };
    }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}