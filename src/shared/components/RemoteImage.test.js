import { fireEvent, render, screen } from '@testing-library/react-native';

import RemoteImage from './RemoteImage';

const FILE_ID = '1AbCdEfGhIjKlMnOp';
const DRIVE = `https://drive.google.com/file/d/${FILE_ID}/view`;

const image = () => screen.getByTestId('img');

describe('RemoteImage (§19.7 native equivalents)', () => {
  it('starts on the stored URL and sends no referrer', async () => {
    await render(<RemoteImage uri="https://cdn.test/a.png" testID="img" />);
    expect(image().props.source).toEqual({ uri: 'https://cdn.test/a.png', headers: { Referer: '' } });
  });

  it('advances through the Drive variants on each load error', async () => {
    await render(<RemoteImage uri={DRIVE} testID="img" />);
    expect(image().props.source.uri).toBe(DRIVE);

    await fireEvent(image(), 'error');
    expect(image().props.source.uri).toBe(`https://drive.google.com/uc?export=view&id=${FILE_ID}`);

    await fireEvent(image(), 'error');
    expect(image().props.source.uri).toBe(`https://drive.google.com/uc?export=download&id=${FILE_ID}`);
  });

  it('reports exhaustion only once every candidate has failed', async () => {
    const onExhausted = jest.fn();
    await render(<RemoteImage uri={DRIVE} onExhausted={onExhausted} testID="img" />);

    // Six candidates: the raw URL plus five Drive forms.
    for (let i = 0; i < 5; i += 1) {
      await fireEvent(image(), 'error');
      expect(onExhausted).not.toHaveBeenCalled();
    }
    await fireEvent(image(), 'error');
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when there is no URL', async () => {
    await render(<RemoteImage uri="" testID="img" />);
    expect(screen.queryByTestId('img')).not.toBeOnTheScreen();
  });
});
