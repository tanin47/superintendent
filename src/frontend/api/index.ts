
export function firstEndpoint(opts: {question: any}): Promise<{answer: any}> {
  console.log(opts)
  return Promise.resolve({
    answer: '42'
  });
}
