const sqlite3 = require('sqlite3')
const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
let db = null

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

const init = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: '${e}'`)
    process.exit(1)
  }
}

init()

const state = obj => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  }
}

const district = obj => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authourization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const query = `SELECT * FROM user WHERE username = ${username}`
  const user = await db.get(query)

  if (user === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const pwMatch = await bcrypt.compare(password, user.password)

    if (pwMatch === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const query = `SELECT * FROM state`
  const res = await db.all(query)
  response.send(res.map(i => state(i)))
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const q = `select * from state where state_id = ${stateId}`
  const res = await db.get(q)
  response.send(state(res))
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const q = `INSERT INTO disrict (state_id,district_name,cases,cured,active,deaths) 
  VALUES(${stateId},${districtName},${cases},${cured},${active},${deaths})`
  const res = await db.run(q)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const q = `SELECT * FROM district WHERE district_id = ${districtId}`
    const res = await db.get(q)
    response.send(district(res))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const q = `DELETE FROM district WHERE district_id = ${districtId}`
    await db.run(q)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cures, active, deaths} = request.body
    const q = `UPDATE district SET district_name = '${districtName}',
   state_id = '${stateId}', cases = '${cases}', cures = '${cures}', active = '${active}' , deaths = '${deaths}' 
   WHERE district_id = '${districtId}'`

    const res = await db.run(q)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const q = `SELECT sum(cases),sum(cured),sum(active),sum(deaths) FROM state WHERE state_id = '${stateId}'`
    response.send({
      totalCases: q['sum(cases)'],
      totalCured: q['sum(cured)'],
      totalActive: q['sum(active)'],
      totalDeaths: q['sum(deaths)'],
    })
  },
)
module.exports = app
