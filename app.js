const express = require("express");
const app = express();
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
let db = null;
const convertObjectIntoStates = (object) => {
    return {
        stateId: object.state_id,
        stateName: object.state_name,
        population: object.population,
    }
}
const convertObjectIntoDistrict = (Object) => {
    return {
        districtId: Object.district_id,
        districtName: Object.district_name,
        stateId: Object.state_id,
        cases: Object.cases,
        cured: Object.cured,
        active: Object.active,
        deaths: Object.deaths,
    }
}
const initializeDBANDServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });
        app.listen(3000);
    } catch (e) {
        console.log(`DB ERROR :${e}`);
        process.exit(1);
    }
};
initializeDBANDServer();
const verifyUser = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"]
    if (authHeader !== undefined) {
        jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
        response.status(401);
        response.send("Invalid JWT token");
    }
    else {
        jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
            if (error) {
                response.status(401);
                response.send("Invalid JWT token");
            }
            else {
                next();
            }
        })
    }
}
app.post("/login/", async (request, response) => {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
        response.status(400);
        response.send("Invalid User");
    } else {
        const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
        if (isPasswordMatched === true) {
            const payload = {
                username: username,
            };
            const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
            response.send({ jwtToken });
        } else {
            response.status(400);
            response.send("Invalid Password");
        }
    }
});
app.get("/states/", verifyUser, async (request, response) => {
    const getQuery = `SELECT * FROM state;`;
    const allStates = await db.all(getQuery);
    response.send(allStates.map((eachObject) => convertObjectIntoStates(eachObject)));
});
app.get("/states/:stateId/", verifyUser, async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `SELECT * FROM state 
    WHERE state_id=${stateId};`;
    const getDetails = await db.get(getQuery);
    response.send(convertObjectIntoStates(getDetails));
});
app.post("/districts/", verifyUser, async (request, response) => {
    const { districtName, stateId, cases, cured, active, deaths } = request.body;
    const postQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES ("${districtName}",${stateId},${cases},${cured},${active},${death});`;
    await db.run(postQuery);
    response.send("District Successfully Added");

})
app.get("/districts/:districtId/", verifyUser, async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
    const getDetails = await db.get(getQuery);
    response.send(getDetails.map((object) => convertObjectIntoDistrict(object)));
});
app.delete("/districts/:districtId/", verifyUser, async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
});
app.put("/districts/:districtId/", verifyUser, async (request, response) => {
    const { districtId } = request.params;
    const { districtName, stateId, cases, cured, active, deaths } = request.body;
    const putQuery = `UPDATE district 
    SET district_name="${districtName}".
    state_id=${stateId},
    cases=${cases},cured=${cured},
    active=${active},deaths=${deaths} 
    WHERE district_id=${districtId};`;
    await db.run(putQuery);
    response.send("District Details Updated");

});
app.get("/states/:stateId/stats/", verifyUser, async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district
     WHERE state_id=${stateId};`;
    const getDetails = await db.get(getQuery);
    response.send(getDetails);
});
module.exports = app;