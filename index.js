require('dotenv').config()

const Octokat = require("octokat");
const puppeteer = require("puppeteer");
const fs = require("fs");

const github = new Octokat({
    token: process.env.ACCESS_TOKEN,
});

// Logging for debugging
console.log('Access Token is set:', !!process.env.ACCESS_TOKEN);
console.log('Guilded Webhook is set:', !!process.env.GUILDED_WEBHOOK);

async function extractBundle() {
    function extractPrivateCache(wreq) {
        let cache = null;
        const sym = Symbol("wpgrabber.extract");

        Object.defineProperty(Object.prototype, sym, {
            get() {
                cache = this;
                return { exports: {} };
            },
            set() { },
            configurable: true,
        })

        wreq(sym);
        delete Object.prototype[sym];
        if (cache) delete cache[sym];

        return cache;
    }

    console.log('Preparing browser');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox'],
    });
    console.log('Creating page');
    const page = await browser.newPage();
    console.log('Created page');
    var extractedData = null;
    page.exposeFunction("logTerminal", console.log);
    page.on("domcontentloaded", async () => {
        console.log('Document loaded');
        extractedData = await page.evaluate(() => {
            const ENDPOINT_ARGS_REGEX = /\s*\({([\w:,\s=!\{\}"]+)}\)\s*=>/;
            const ENDPOINT_ARGS_2_REGEX = /\s*\({([\w:,\s=!]+)}={[\w:,\s]*}\)\s*/;
            const ENDPOINT_ARGS_3_REGEX = /\w+\(\{?([\w:,\s=!]+)\}?\){/;
            const ENDPOINT_ARGS_SINGLE_REGEX = /\s*([\w:,\s]+)=>\(/;
            const ENDPOINT_ARGS_SINGLE_2_REGEX = /\s*([\w:,\s]+)=>\{/;
            const ENDPOINT_BODY_REGEX = /data:\s*JSON.stringify\({([\w:,\s]+)}\)/;
            const ENDPOINT_URL_REGEX = /url:\s*([\w:,"\.\s()&+=\-?!{}/|]+),\s*type/;
            const ENDPOINT_TYPE_REGEX = /type:\s*"([\w]+)"/;
            const ENDPOINT_URL_CONCAT_REGEX = /\.concat\(([\w.,"/]+)\)/g;
            const ENDPOINT_URL_STRING_REGEX = /([\w"\.\/]+)\s*\+(\s*[\w"\.\/]+)/;
            const ENDPOINT_ENCODE_REGEX = /encodeURIComponent\(([\w.,"/]+)\)/;
            const GATE_RETURN_REGEX = /return\s*([\w!.|"()]+)}/;

            function stripQuotes(text) {
                if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
                return text;
            }

            function stripDefault(text) {
                return text.split("=")[0];
            }

            const values = o => (Array.isArray(o) ? o : Object.values(o));
            const log = (...args) => {
                window.logTerminal(...args);
            }
            return new Promise((resolve, reject) => {
                log('Listening for stuff')
                Object.defineProperty(Function.prototype, "m", {
                    set(v) {
                        const source = this.toString();
                        if (
                            source.includes("exports") &&
                            (source.includes("false") || source.includes("!1")) &&
                            !(Array.isArray(v) && v?.some(m => m.toString().includes("CHROME_WEBSTORE_EXTENSION_ID"))) // react devtools
                        ) {
                            window.WEBPACK_GRABBER = {
                                require: this,
                                get cache() {
                                    this.require.c ??= extractPrivateCache(this.require);
                                    return this.require.c;
                                },
                                get modules() {
                                    return this.require.m;
                                },
                                get entryPoint() {
                                    return this.require.s;
                                },
                                get path() {
                                    return this.require.p;
                                },
                                get getDefaultExport() {
                                    return this.require.n;
                                },
                                cacheValues() {
                                    return values(this.cache);
                                },
                                moduleValues() {
                                    return values(this.modules);
                                },
                
                                find(filter) {
                                    const values = this.cacheValues();
                                    for (const { exports } of values) {
                                        if (exports && filter(exports)) return exports;
                                        if (exports?.default && filter(exports.default)) return exports.default;
                                        if (typeof exports === "object" && exports !== window) {
                                            // Mangled exports
                                            for (const key in exports) {
                                                if (key.length > 3 || !exports[key]) continue;
                                                if (filter(exports[key])) return exports[key];
                                            }
                                        }
                                    }
                                    return null;
                                },
                
                                findAll(filter) {
                                    const results = [];
                                    const values = this.cacheValues();
                                    for (const { exports } of values) {
                                        if (exports && filter(exports)) results.push(exports);
                                        else if (exports?.default && filter(exports.default)) results.push(exports.default);
                                        if (typeof exports === "object" && exports !== window) {
                                            // Mangled exports
                                            for (const key in exports) {
                                                if (key.length > 3 || !exports[key]) continue;
                                                if (filter(exports[key])) {
                                                    results.push(exports[key]);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    return results;
                                },
                
                                filters: {
                                    byProps:
                                        (...props) =>
                                        m =>
                                            props.every(p => m[p] !== void 0),
                                    byDisplayName: displayName => m => m.displayName === displayName,
                                    byName: name => m => m.name === name,
                                    byCode:
                                        (...codes) =>
                                        m => {
                                            if (typeof m !== "function") return false;
                                            const code = Function.prototype.toString.call(m);
                                            return codes.every(c => {
                                                if (typeof c === "string") return code.includes(c);
                                                if (c instanceof RegExp) {
                                                    const matches = c.test(code);
                                                    c.lastIndex = 0;
                                                    return matches;
                                                }
                                                throw new Error("findByCode: Expected one or more RegExp or string, got " + typeof c);
                                            });
                                        },
                                },
                
                                findByProps(...props) {
                                    return this.find(this.filters.byProps(...props));
                                },
                                findAllByProps(...props) {
                                    return this.findAll(this.filters.byProps(...props));
                                },
                                findByDisplayName(displayName) {
                                    return this.find(this.filters.byDisplayName(displayName));
                                },
                                findAllByDisplayName(displayName) {
                                    return this.findAll(this.filters.byDisplayName(displayName));
                                },
                                findByName(name) {
                                    return this.find(this.filters.byName(name));
                                },
                                findAllByName(name) {
                                    return this.findAll(this.filters.byName(name));
                                },
                                findByCode(...codes) {
                                    return this.find(this.filters.byCode(...codes));
                                },
                                findAllByCode(...codes) {
                                    return this.findAll(this.filters.byCode(...codes));
                                },
                                findId(...codes) {
                                    const filter = this.filters.byCode(...codes);
                                    for (const id in this.modules) {
                                        if (filter(this.modules[id])) return id;
                                    }
                                    return null;
                                },
                                findModuleBySourceCode(...codes) {
                                    const id = this.findId(...codes);
                                    return id && this.require(id);
                                },
                            };
                
                            delete Function.prototype.m;
                            this.m = v;

                            setTimeout(() => {
                                log('Locating gates...')
                                log(`Gates ID: ${WEBPACK_GRABBER.findId("GateIsEnabled")}`)
                                const gatesGetter = WEBPACK_GRABBER.require(WEBPACK_GRABBER.findId("GateIsEnabled"));
                                log('Gates located')
                                let gates = Object.keys(Object.getOwnPropertyDescriptors(gatesGetter.default));
                                log('Extracted gates')
        
                                for (let i = 0; i < gates.length; i++) {
                                    if (gates[i].startsWith("__") || gates[i].startsWith("$")) {
                                        gates.splice(i, 1);
                                        i--;
                                        continue;
                                    }
                                    let gate = gates[i];
                                    try {
                                        const func = gatesGetter.default.$mobx.values[gate].derivation;
                                        const funcString = func.toString();
                                        const ret = GATE_RETURN_REGEX.exec(funcString);
                                        if (ret) {
                                            const conditions = ret[1].split("||");
                                            if (conditions.length > 1) {
                                                gate += " - ";
                                                let toConcat = [];
                                                for (let j = 0; j < conditions.length; j++) {
                                                    const cond = conditions[j];
                                                    let negative = !cond.includes("!");
                                                    if (cond.includes("IsProd")) {
                                                        toConcat.push("".concat(
                                                            negative ? "Enabled in "
                                                            : "Disabled in ",
                                                            "Production"
                                                        ));
                                                    }
                                                    else if (cond.includes("IsDev")) {
                                                        toConcat.push("".concat(
                                                            negative ? "Enabled in "
                                                            : "Disabled in ",
                                                            "Development"
                                                        ));
                                                    }
                                                    else if (cond.includes("IsTest")) {
                                                        toConcat.push("".concat(
                                                            negative ? "Enabled in "
                                                            : "Disabled in ",
                                                            "Testing"
                                                        ));
                                                    }
                                                }
                                                gate += toConcat.join(", ");
                                                gates[i] = gate;
                                            }
                                        }
                                        log(gates[i])
                                    } catch (e) {
                                        log(`Failed to parse gate "${gates[i]}": ${e}`)
                                    }
                                }

                                log('Locating base URLs...')
                                const baseUrls = WEBPACK_GRABBER.require(WEBPACK_GRABBER.findId("BaseUrl"));
                                log('Located base URLs')
                                const baseUrl = baseUrls.default.BaseUrl;
                                const baseVideoUrl = baseUrls.default.BaseVideoUrl || "[BASE_VIDEO_URL]";
                                // This seems to only be present in developer or local environments,
                                // so just replace it with a placeholder instead if not present

                                log('Locating endpoints...')
                                const endpointObject = WEBPACK_GRABBER.require(WEBPACK_GRABBER.findId("getUserById:"));
                                log('Located endpoints')
                                let endpoints = [];
                                let endpointNames = Object.keys(Object.getOwnPropertyDescriptors(endpointObject.default));
                                
                                for (let i = 0; i < endpointNames.length; i++) {
                                    log(`Parsing endpoint ${endpointNames[i]}...`)
                                    try {
                                        const funcString = endpointObject.default[endpointNames[i]].toString();
                                        const _url = ENDPOINT_URL_REGEX.exec(funcString);
                                        const _type = ENDPOINT_TYPE_REGEX.exec(funcString);
                                        const _body = ENDPOINT_BODY_REGEX.exec(funcString);
                                        const _args = ENDPOINT_ARGS_REGEX.exec(funcString);
                                        const _args2 = ENDPOINT_ARGS_2_REGEX.exec(funcString);
                                        const _args3 = ENDPOINT_ARGS_3_REGEX.exec(funcString);
                                        const _argsSingle = ENDPOINT_ARGS_SINGLE_REGEX.exec(funcString);
                                        const _argsSingle2 = ENDPOINT_ARGS_SINGLE_2_REGEX.exec(funcString);

                                        if (!_url && !_type && !_body && !_args && !_args2 && !_args3 && !_argsSingle) {
                                            continue;
                                            // This is an impossible function to analyze, just skip it
                                        }

                                        let args = {};
                                        if (_args) {
                                            let sep = _args[1].split(",");
                                            for (let i = 0; i < sep.length; i++) {
                                                let split = sep[i].split(":");
                                                if (split.length == 2) {
                                                    args[stripDefault(split[1].trim())] = split[0].trim();
                                                } else {
                                                    args[stripDefault(split[0].trim())] = `unnamed(${stripDefault(split[0].trim())})`;
                                                }
                                            }
                                        }
                                        if (_argsSingle) {
                                            args[_argsSingle[1]] = "unnamed";
                                        }
                                        if (_argsSingle2) {
                                            args[_argsSingle2[1]] = "unnamed";
                                        }
                                        if (_args2) {
                                            let sep = _args2[1].split(",");
                                            for (let i = 0; i < sep.length; i++) {
                                                let split = sep[i].split(":");
                                                if (split.length == 2) {
                                                    args[stripDefault(split[1].trim())] = split[0].trim();
                                                } else {
                                                    args[stripDefault(split[0].trim())] = `unnamed(${stripDefault(split[0].trim())})`;
                                                }
                                            }
                                        }
                                        if (_args3) {
                                            let sep = _args3[1].split(",");
                                            for (let i = 0; i < sep.length; i++) {
                                                let split = sep[i].split(":");
                                                if (split.length == 2) {
                                                    args[stripDefault(split[1].trim())] = split[0].trim();
                                                } else {
                                                    args[stripDefault(split[0].trim())] = `unnamed(${stripDefault(split[0].trim())})`;
                                                }
                                            }
                                        
                                        }
                                        const argKeys = Object.keys(args);

                                        for (let i = 0; i < argKeys.length; i++) {
                                            let match = (new RegExp(`(\\w+):(\\w+)\}=${argKeys[i]}`)).exec(funcString);
                                            if (match) {
                                                args[match[2]] = match[1];
                                            }
                                        }

                                        function parseURL(__url) {
                                            const _url = [undefined, __url];
                                            if (_url[1].length == 1) {
                                                let urlVar = (new RegExp(`const\\s*${_url[1]}=([\\w?".(),/:]+);`)).exec(funcString);
                                                if (urlVar) {
                                                    let conditionalRe = /\?([\w?".(),/:]+):([\w?".(),/:]+)/.exec(urlVar);
                                                    if (conditionalRe) {
                                                        return `${parseURL(conditionalRe[1])} OR ${parseURL(conditionalRe[2])}`;
                                                    } else {
                                                        return parseURL(urlVar);
                                                    }
                                                } else {
                                                    return "UNKNOWN";
                                                }
                                            }
                                            let url = "";
                                            let _urlCI = 0;
                                            let _urlStrings = ENDPOINT_URL_STRING_REGEX.exec(_url[1]);
                                            if (_urlStrings && !ENDPOINT_URL_CONCAT_REGEX.test(_url[1])) {
                                                const leftSide = _urlStrings[1];
                                                let rightSide = stripQuotes(_urlStrings[2]);

                                                if (leftSide.includes("BaseUrl")) {
                                                    url += baseUrl;
                                                } else if (leftSide.includes("BaseVideoUrl")) {
                                                    url += baseVideoUrl;
                                                }

                                                if (rightSide.includes("encodeURIComponent")) {
                                                    rightSide = ENDPOINT_ENCODE_REGEX.exec(rightSide)[1];
                                                }
                                                url += rightSide;
                                            } else {
                                                let _urlConcats;
                                                if (_url[1].includes("BaseUrl+")) {
                                                    url += baseUrl;
                                                    _urlCI++;
                                                } else if (_url[1].includes("BaseVideoUrl+")) {
                                                    url += baseVideoUrl;
                                                    _urlCI++;
                                                }
                                                ENDPOINT_URL_CONCAT_REGEX.lastIndex = 0;
                                                do {
                                                    _urlConcats = ENDPOINT_URL_CONCAT_REGEX.exec(_url[1]);
                                                    if (_urlConcats) {
                                                        _urlCI++;
                                                        if (url.length > 0 && !url.endsWith("/")) url += "/";
                                                        let concatArgs = _urlConcats[1].split(",");
                                                        if (concatArgs.length == 2) {
                                                            let p1 = stripQuotes(concatArgs[0]);
                                                            if (p1.includes("encodeURIComponent")) {
                                                                p1 = ENDPOINT_ENCODE_REGEX.exec(p1)[1];
                                                            }
                                                            if (p1) {
                                                                let p1Split = p1.split(".");
                                                                if (p1.toLowerCase().includes("baseurl")) {
                                                                    p1 = baseUrl;
                                                                } else if (p1.toLowerCase().includes("basevideourl")) {
                                                                    p1 = baseVideoUrl;
                                                                } else {
                                                                    if (args[p1]) {
                                                                        p1 = `<${args[p1].toUpperCase()}>`;
                                                                    } else {
                                                                        if (p1Split.length > 1) {
                                                                            p1 = `<${p1Split[1].toUpperCase()}>`;
                                                                        } else {
                                                                            if (_urlCI == 0) {
                                                                                p1 = baseUrl; // Assume base URL if unknown and is first item
                                                                            } else {
                                                                                p1 = "<UNKNOWN>";
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            } else {
                                                                log(`Failed to find p1 for ${concatArgs[0]} of ${_urlConcats[1]}`);
                                                                p1 = "<UNKNOWN>";
                                                            }
                                                            url += "".concat(p1, stripQuotes(concatArgs[1]));
                                                        } else {
                                                            let queryName = null;
                                                            let queryArg = null;
                                                            let splitArg = concatArgs[0].split(".");
    
                                                            if (splitArg.length == 1) {
                                                                for (let j = 0; j < argKeys.length; j++) {
                                                                    const arg = args[argKeys[j]];
                                                                    const argLetter = argKeys[j];
                                                                    let queryString = (new RegExp(`"\?(\w+)=".concat\(.*(${argLetter})\)`)).exec(funcString);
                                                                    if (queryString) {
                                                                        queryName = queryString[1];
                                                                        queryArg = arg;
                                                                        break;
                                                                    }
                                                                }
            
                                                                if (queryName && queryArg) {
                                                                    url += `?${queryName}=<${queryArg.toUpperCase()}>`;
                                                                }
                                                            } else {
                                                                url += `<${splitArg[1].toUpperCase()}>`;
                                                            }
                                                        }
                                                    }
                                                } while (_urlConcats);
                                            }
                                            return url;
                                        }
                                        let url = parseURL(_url[1]);

                                        let body = {};
                                        if (_body) {
                                            let sep = _body[1].split(",");
                                            for (let i = 0; i < sep.length; i++) {
                                                let split = sep[i].split(":");
                                                let p1 = args[split[1].trim().split(".")[0]];
                                                if (p1) {
                                                    body[split[0].trim()] = `<${p1.toUpperCase()}>`;
                                                } else {
                                                    log(args);
                                                    log(funcString);
                                                    log(split[1].trim().split(".")[0]);
                                                }
                                            }
                                        }
                                        
                                        let type = "UNKNOWN";
                                        if (_type) {
                                            type = _type[1];
                                        }

                                        endpoints.push({
                                            name: endpointNames[i],
                                            url: url,
                                            _url: _url[1],
                                            type: type,
                                            body: JSON.stringify(body),
                                            args: JSON.stringify(args),
                                        });
                                    } catch (e) {
                                        log(`Failed to parse endpoint ${endpointNames[i]}: ${e}`);
                                    }
                                }

                                const gitHash = WEBPACK_GRABBER.require(WEBPACK_GRABBER.findId("appType")).default.DeviceDetails.gitHash;
                                const _games = WEBPACK_GRABBER.require(WEBPACK_GRABBER.findId("gameIndex"));
                                let games = [];

                                if (_games) {
                                    for (let i = 0; i < _games.length; i++) {
                                        const game = _games[i];
                                        games.push(`${game.codeFriendlyName};${game.gameIndex};${game.id};${game.icon};${game.color}`);
                                    }
                                }

                                games = games.sort((a, b) => {
                                    const nameA = a.split(";")[0];
                                    const nameB = b.split(";")[0];

                                    return nameA.localeCompare(nameB);
                                });

                                let scriptUrls = [];
                                let scripts = document.querySelectorAll("link[as=\"script\"]");
                                for (let i = 0; i < scripts.length; i++) {
                                    scriptUrls.push(scripts[i].href);
                                }

                                fetch(window.bundle.src).then((resp) => {
                                    resp.text().then((bundleCode) => {
                                        resolve({
                                            gates: gates,
                                            endpoints: endpoints,
                                            gitHash: gitHash,
                                            games: games,
                                            scripts: scriptUrls,
                                            version: WEBPACK_GRABBER.path.replaceAll("/", ""),
        
                                            bundleCode: bundleCode,
                                        });
                                    })
                                });
                            }, 10);
                        } else {
                            // huh not webpack_require
                            Object.defineProperty(this, "m", {
                              value: v,
                              configurable: true,
                              writable: true,
                              enumerable: true
                            });
                        }
                    },
                    configurable: true,
                });
            })
        })
    });
    await page.goto("https://guilded.gg");

    while (!extractedData) {
        console.log('Waiting for data');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    await browser.close();

    return extractedData;
}

const WRITE_COMMIT = true;
const LOG_ENDPOINTS = ["getUserById", "getUserGifs", "createInvite"];

( async () => {
    const data = await extractBundle();
    const currentDate = new Date();
    const year = currentDate.getFullYear(), month = currentDate.getMonth() + 1, day = currentDate.getDate();

    let hashTxt = null;
    try {
        hashTxt = fs.readFileSync(`./hash.txt`, "utf8");
    } catch (e) {
        // ignore
    }
    if (hashTxt == data.gitHash && WRITE_COMMIT) {
        console.log("No changes since last check")
        return;
    }
    fs.writeFileSync(`./hash.txt`, data.gitHash);
    
    const basePath = `${year}/${month}/${data.version}`;
    const repo = await github.repos("LightCircleLLC", "Guilded-Datamining").fetch();
    let main = await repo.git.refs('heads/main').fetch();
    let treeItems = [];

    let bundleGit = await repo.git.blobs.create({
        content: data.bundleCode,
        encoding: "utf-8",
    });
    treeItems.push({
        path: `${basePath}/bundle.js`,
        mode: "100644",
        type: "blob",
        sha: bundleGit.sha,
    });

    let formattedEndpoints = [];
    for (let i = 0; i < data.endpoints.length; i++) {
        const endpoint = data.endpoints[i];
        if (endpoint.url == undefined || endpoint.url.trim() == "") continue;
        formattedEndpoints.push(`[${endpoint.type}] "${endpoint.name}" ${endpoint.url} - ${endpoint.body}`);
        if (LOG_ENDPOINTS.includes(endpoint.name)) {
            console.log(`[${endpoint.type}] "${endpoint.name}" ${endpoint.url} - ${endpoint.body}`);
            console.log(endpoint._url);
        }
    }

    if (!WRITE_COMMIT) {
        return;
    }

    let endpointsGit = await repo.git.blobs.create({
        content: formattedEndpoints.join("\n"),
        encoding: "utf-8",
    });
    treeItems.push({
        path: `${basePath}/endpoints.txt`,
        mode: "100644",
        type: "blob",
        sha: endpointsGit.sha,
    });

    let gatesGit = await repo.git.blobs.create({
        content: data.gates.join("\n"),
        encoding: "utf-8",
    });
    treeItems.push({
        path: `${basePath}/gates.txt`,
        mode: "100644",
        type: "blob",
        sha: gatesGit.sha,
    });

    let gamesGit = await repo.git.blobs.create({
        content: data.games.join("\n"),
        encoding: "utf-8",
    });
    treeItems.push({
        path: `${basePath}/games.txt`,
        mode: "100644",
        type: "blob",
        sha: gamesGit.sha,
    });

    let currentBundleGit = await repo.git.blobs.create({
        content: data.bundleCode,
        encoding: "utf-8",
    });
    treeItems.push({
        path: `current.js`,
        mode: "100644",
        type: "blob",
        sha: currentBundleGit.sha,
    });

    let currentGatesGit = await repo.git.blobs.create({
        content: data.gates.join("\n"),
        encoding: "utf-8",
    });
    treeItems.push({
        path: `currentGates.txt`,
        mode: "100644",
        type: "blob",
        sha: currentGatesGit.sha,
    });

    let currentGamesGit = await repo.git.blobs.create({
        content: data.games.join("\n"),
        encoding: "utf-8",
    });
    treeItems.push({
        path: `currentGames.txt`,
        mode: "100644",
        type: "blob",
        sha: currentGamesGit.sha,
    });

    let currentEndpointsGit = await repo.git.blobs.create({
        content: formattedEndpoints.join("\n"),
        encoding: "utf-8",
    });
    treeItems.push({
        path: `currentEndpoints.txt`,
        mode: "100644",
        type: "blob",
        sha: currentEndpointsGit.sha,
    });

    let tree = await repo.git.trees.create({
        tree: treeItems,
        base_tree: "main",
    });
    let formattedScripts = "";

    for (let i = 0; i < data.scripts.length; i++) {
        formattedScripts += `- ${data.scripts[i]}\n`;
    }

    let message = `${year} ${currentDate.toLocaleDateString("default", { month: 'long' })} ${day} - Build ${data.version} (${data.gitHash})\nScripts:\n${formattedScripts}`;
    let commit = await repo.git.commits.create({
        message: message,
        tree: tree.sha,
        parents: [main.object.sha],
    });

    main.update({sha: commit.sha}).then(() => {
        let webhookPayload = {
            "content": "<@36931999>",
            "allowed_mentions": {
                "roles": [36931999],
            },
            "embeds": [
                {
                    "title": "New Client Version",
                    "url": commit.htmlUrl,
                    "description": `A new client version was released!`,
                    "color": 16106496,
                    "fields": [
                        {
                            "name": "Version",
                            "value": data.version,
                        }
                    ],
                    "footer": {
                        "text": "Guilded Datamining"
                    },
                    "timestamp": new Date().toISOString(),
                }
            ]
        };

        if (fs.existsSync(`./.cache`)) {
            const oldEndpoints = fs.readFileSync(`./.cache/endpoints.txt`, "utf8").split("\n");
            let oldGames = fs.readFileSync(`./.cache/games.txt`, "utf8").split("\n");
            let oldGates = fs.readFileSync(`./.cache/gates.txt`, "utf8").split("\n");
    
            let newGates = [];
            let newGames = [];
    
            // Make sure all gates in oldGates only include the gate name
            for (let i = 0; i < oldGates.length; i++) {
                oldGates[i] = oldGates[i].split(" ")[0];
            }
    
            // Create a copy of current gates with only the gate name
            for (let i = 0; i < data.gates.length; i++) {
                const gateName = data.gates[i].split(" ")[0];
                newGates.push(gateName);
            }
    
            // Compare the gates
            let changedGates = {
                added: [],
                removed: [],
            };
    
            for (let i = 0; i < data.gates.length; i++) {
                const gateName = data.gates[i].split(" ")[0]; 
                if (!oldGates.includes(gateName)) {
                    changedGates.added.push(gateName);
                }
            }
    
            for (let i = 0; i < oldGates.length; i++) {
                const gateName = oldGates[i];
                if (!newGates.includes(gateName)) {
                    changedGates.removed.push(gateName);
                }
            }
    
            // Make sure all games in oldGames only include the game name
            for (let i = 0; i < oldGames.length; i++) {
                oldGames[i] = oldGames[i].split(";")[0];
            }
    
            // Create a copy of current games with only the game name
            for (let i = 0; i < data.games.length; i++) {
                const gameName = data.games[i].split(";")[0];
                newGames.push(gameName);
            }
    
            let changedGames = {
                added: [],
                removed: [],
            };
    
            // Compare the games
            for (let i = 0; i < data.games.length; i++) {
                const gameName = data.games[i].split(";")[0];
                if (!oldGames.includes(gameName)) {
                    changedGames.added.push(gameName);
                }
            }
    
            for (let i = 0; i < oldGames.length; i++) {
                const gameName = oldGames[i];
                if (!newGames.includes(gameName)) {
                    changedGames.removed.push(gameName);
                }
            }
    
            if (changedGates.added.length > 0 || changedGates.removed.length > 0) {
                let diff = "```diff\n";
                if (changedGates.added.length > 0) {
                    for (let i = 0; i < changedGates.added.length; i++) {
                        diff += `+ ${changedGates.added[i]}\n`;
                    }
                }
                if (changedGates.removed.length > 0) {
                    for (let i = 0; i < changedGates.removed.length; i++) {
                        diff += `- ${changedGates.removed[i]}\n`;
                    }
                }
                diff += "```";
                webhookPayload.embeds[0].fields.push({
                    "name": "Gates",
                    "value": diff,
                });
            }
    
            if (changedGames.added.length > 0 || changedGames.removed.length > 0) {
                let diff = "```diff\n";
                if (changedGames.added.length > 0) {
                    for (let i = 0; i < changedGames.added.length; i++) {
                        diff += `+ ${changedGames.added[i]}\n`;
                    }
                }
                if (changedGames.removed.length > 0) {
                    for (let i = 0; i < changedGames.removed.length; i++) {
                        diff += `- ${changedGames.removed[i]}\n`;
                    }
                }
                diff += "```";
                webhookPayload.embeds[0].fields.push({
                    "name": "Games",
                    "value": diff,
                });
            }
    
            fetch(process.env.GUILDED_WEBHOOK, {
                method: "POST",
                body: JSON.stringify(webhookPayload),
                headers: {
                    "Content-Type": "application/json",
                },
            }).then((resp) => {
                console.log(resp.status);
            });
        }
    
        fs.writeFileSync(`./.cache/bundle.js`, data.bundleCode);
        fs.writeFileSync(`./.cache/endpoints.txt`, formattedEndpoints.join("\n"));
        fs.writeFileSync(`./.cache/gates.txt`, data.gates.join("\n"));
        fs.writeFileSync(`./.cache/games.txt`, data.games.join("\n"));
    });
    console.log("Pushed new version successfully");
    console.log(commit.htmlUrl);
})();