const fs=require("fs");
try{const b=fs.readFileSync(""$ARENA_WORKSPACE"/test/hooked.html");console.log("FILE OK",b.length);}catch(e){console.log("FILE FAIL",e.code);}
try{console.log("DIR",fs.readdirSync(""$ARENA_WORKSPACE"/test").length);}catch(e){console.log("DIR FAIL",e.code);}
