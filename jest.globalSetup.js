// Run every test in a zone behind UTC so tests that pin "UTC date, not local
// date" (RN-SPEC-plans ⚠7) and timestamp reinterpretation are meaningful on
// any machine. Workers inherit this.
module.exports = async () => {
  process.env.TZ = 'America/Los_Angeles';
};
