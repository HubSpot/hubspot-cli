describe('hs list', () => {
  const { cli } = global;

  it('should print the correct output', async () => {
    let val = await cli.execute(['list']);
    expect(val).toContain('@marketplace');
  }, 20000);
});
