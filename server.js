const fs = require("fs");
const { Pool, Client } = require("pg");
const Koa = require("koa");
const http = require("http");
const axios = require("axios");
const Router = require("koa-router");

const app = new Koa();
const router = new Router();

const pool = new Pool({
	connectionString:process.env.GOOD_DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

const settings = {
	buttonCD: 300,
	lbCount: 20
}

pool.query('SELECT * FROM leaderboard;', (err, res) => {
	let state = {start: 0, scores: res.rows};
	pool.query('SELECT * FROM state;', (err, res) => {
		state.start = res.rows[0].start;

		// main page
		router.get("/", (ctx, next) => {
			console.log("loading main page")
			ctx.type = "html";
			ctx.body = fs.createReadStream("public/index.html");
			next();
		});

		// admin page
		router.get("/admin", (ctx, next) => {
			ctx.type = "html";
			ctx.body = fs.createReadStream("public/admin.html");
			next();
		});

		// js code
		router.get("/button.js", (ctx, next) => {
			ctx.type = "js";
			ctx.body = fs.createReadStream("public/button.js");
			next();
		});

		// css code
		router.get("/style.css", (ctx, next) => {
			ctx.type = "css";
			ctx.body = fs.createReadStream("public/style.css");
			next();
		});

		// API route to get the current state of the game
		router.get("/api/state", (ctx, next) => {
			ctx.body = {start: state.start};
			next();
		});

		// API route to get the current state of the game
		router.get("/api/scores", (ctx, next) => {
			ctx.body = state.scores.sort((a, b) => b.score - a.score);
			next();
		});

		// API route to remove a person out of the game
		router.get("api/remove/:name/:password", ctx => {
			if (ctx.params.password === process.env.adminpass) {
				if (state.scores[name]) {
					delete state.scores[name];
					api.updateBin({
						id: "5f630d16302a837e9567ebf6",
						data: state,
						versioning: false
					});
				}
			}
			next();
		});

		// API route to press the button
		router.get("/api/press/:name", (ctx, next) => {
			const name = ctx.params.name;
			
			if (name.length > 20) {
				return;
			}

			const score = Math.floor(new Date().getTime() / 1000) - state.start;

			if (score < settings.buttonCD) {
				return;
			}

			if (!Boolean(/^[a-z0-9 ]+$/i.exec(name))) {
				return;
			}

			console.log(`${name} pressed the button for ${score} points`);

			// reset timer
			state.start = Math.floor(new Date().getTime() / 1000);
			pool.query(`UPDATE state SET start = ${state.start}`)

			// to little score, nothing changes
			if (state.scores[name] > score) {
				return;
			}

			console.log(`${name} now has ${score} points`);
			if (!state.scores.find(e => e.username === name)) { // new person
				state.scores.push({username: name, score:score})
				console.log(state);
				pool.query(`INSERT INTO leaderboard VALUES ('${name}', ${score});`);
			} else { // old person
				state.scores = state.scores.map((e) => e.username === name ? {username: e.username, score: score} : e);
				pool.query(`UPDATE leaderboard SET score = ${score} WHERE username = '${name}'`);
			}

			ctx.body = "success";
			next();
		});

		// use middleware
		app.use(router.routes());
		app.use(router.allowedMethods());

		console.log("server up");
		// boot server
		http.createServer(app.callback()).listen(process.env.PORT || 3000);

	});
});