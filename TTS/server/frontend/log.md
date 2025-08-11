jonfriis@Gamer:/mnt/c/Github/coqui-ai-TTS/TTS/server/frontend$ npm run build

> coqui-tts-frontend@0.0.0 build
> npx tsc && vite build

src/test/testUtils.ts:423:8 - error TS1161: Unterminated regular expression literal.

423       </AudioProvider>
           ~~~~~~~~~~~~~~~                                                                                                                                                                                                          

src/test/testUtils.ts:424:6 - error TS1161: Unterminated regular expression literal.

424     </ThemeProvider>
         ~~~~~~~~~~~~~~~                                                                                                                                                                                                            

src/test/testUtils.ts:463:44 - error TS1161: Unterminated regular expression literal.

463         content = <AudioProvider>{content}</AudioProvider>;
                                               ~~~~~~~~~~~~~~~                                                                                                                                                                      

src/test/testUtils.ts:467:44 - error TS1161: Unterminated regular expression literal.

467         content = <ThemeProvider>{content}</ThemeProvider>;
                                               ~~~~~~~~~~~~~~~                                                                                                                                                                      

src/test/testUtils.ts:470:15 - error TS1110: Type expected.

470       return <>{content}</>;
                  ~                                                                                                                                                                                                                 

src/test/testUtils.ts:470:26 - error TS1161: Unterminated regular expression literal.

470       return <>{content}</>;
                             ~~                                                                                                                                                                                                     

src/test/testUtils.ts:482:47 - error TS1161: Unterminated regular expression literal.

482       result.rerender(Wrapper ? <Wrapper>{ui}</Wrapper> : ui),
                                                  ~~~~~~~~~~~~~~                                                                                                                                                                    

src/test/testUtils.ts:482:61 - error TS1005: ':' expected.

482       result.rerender(Wrapper ? <Wrapper>{ui}</Wrapper> : ui),
                                                                ~                                                                                                                                                                   


Found 8 errors in the same file, starting at: src/test/testUtils.ts:423