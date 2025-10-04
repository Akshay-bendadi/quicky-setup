import { askQuestions } from './prompts.js';
import { scaffoldProject } from './scaffolder.js';

export async function main(): Promise<void> {
  const answers = await askQuestions();
  await scaffoldProject(answers);
}
