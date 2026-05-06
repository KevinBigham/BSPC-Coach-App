import { getPrompt } from '../ai/prompts';
import { getVideoAnalysisPrompt } from '../ai/videoPrompts';

describe('AI prompt selected swimmer scoping', () => {
  it('renders selected_swimmers in the audio extraction prompt', () => {
    const prompt = getPrompt('Jane looked good. Bob needs kick work.', 'Jane Smith', 'Gold', [
      { id: 's1', displayName: 'Jane Smith' },
    ]);

    expect(prompt).toContain('selected_swimmers:');
    expect(prompt).toContain('swimmer_id: s1');
    expect(prompt).toContain('name: Jane Smith');
    expect(prompt).toContain(
      'ONLY produce observation drafts for the swimmers listed above. Ignore mentions of any other swimmer.',
    );
    expect(prompt).not.toContain('swimmer_id: s2');
  });

  it('renders selected_swimmers in the video analysis prompt', () => {
    const prompt = getVideoAnalysisPrompt([{ id: 's1', displayName: 'Jane Smith' }], 'Gold');

    expect(prompt).toContain('selected_swimmers:');
    expect(prompt).toContain('swimmer_id: s1');
    expect(prompt).toContain('name: Jane Smith');
    expect(prompt).toContain(
      'ONLY produce observation drafts for the swimmers listed above. Ignore mentions of any other swimmer.',
    );
    expect(prompt).not.toContain('swimmer_id: s2');
  });
});
