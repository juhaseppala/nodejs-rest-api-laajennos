import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import { db } from './database/sqlite.js';
import { compare, hash } from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'
import { JWT_SECRET } from './src/config.js';
import { adminOnly, authenticate } from './src/middlewares/auth.js';


const app = express()

app.use(express.json())
app.use(cookieParser())

const router = Router();
const saltRounds = 10

router.get('/user/account', authenticate, (req, res)=>{

    res.json(req.userData)

 })

router.get("/user", authenticate, adminOnly, (req, res)=>{

    db.all('SELECT id, username, age, role FROM user', [], (err, rows)=>{

        if(err){
            return res.status(404).send('User not found')
        }

        res.send(JSON.stringify(rows))

        console.log(rows)
        rows.forEach((row)=>{
            console.log(row)
        })

        // res.send("dataa myöhemmin tästä.")

    })

})

router.get("/user/:id", (req, res)=>{
    const id = req.params.id
    //res.send("Tässä palautetaan käyttäjä id:n perusteella" + req.params.id)

    db.get('SELECT id, username, age, role FROM user WHERE id = ?', [id], (err, row)=>{
        
        if (err){
            return res.status(404).send("User not found")
        }

        res.send(JSON.stringify(row))

    })


})

router.post("/user", async (req, res)=>{
    const {username, password, age, role} =req.body

    if(!username || !age || !password || !role) {
        return res.status(400).send("Tarkista tiedot")
    }
    
    const hashedPassword = await hash(password, saltRounds)

        const stmt = db.prepare("INSERT INTO user VALUES (NULL, ?, ?, ?, NULL, ?)")
    
        stmt.run(username, hashedPassword, age, role, (err)=>{

            if (err){
                // Ei tehdä tuotantoympäristössä
                return res.status(400).json({
                    error: "Käyttäjänimi käytössä, kokeile uutta käyttäjänimeä"
                })
            }

            res.status(201).send("Käyttäjä luotu")
        })

    
})

router.put("/user", (req, res)=>{

    const {username, age, id} =req.body

    if(!username || !age || !id) {
        return res.status(400).send("Tarkista tiedot")
    }

    db.serialize(()=>{

        const stmt = db.prepare("UPDATE user SET username = ?, age = ? WHERE id = ?")

        stmt.run(username, age, id)

        stmt.finalize()

        res.send("Käyttäjä päivitetty onnistuneesti")

    })
})

router.patch("/user", (req, res)=>{
    res.send("Tällä päivitetään yksittäinen tieto tietokannasta")
})

router.delete("/user/:id", (req, res)=>{
const id = req.params.id
db.run("DELETE FROM user WHERE id = ?", [id], (err)=>{

        if(err){
            return res.status(404).send()
        }

        res.send("Käyttäjätili poistettu onnistuneesti")

    })

})

router.post('/user/login', (req, res)=>{

    const {username, password} = req.body

    if(!username || !password){
    return res.status(400).send()
    }

    db.get('SELECT id, password, role FROM user WHERE username = ?', [username], async (err, row)=>{
        
        if (err || !row){
            return res.status(404).send()
        }

       const isAuthenticated = await compare(password, row.password)

        if(isAuthenticated){

            const jti = crypto.randomUUID()

            
          
            const token = jwt.sign({
                role: row.role
            }, JWT_SECRET, {
                expiresIn: '1h',
                jwtid: jti
            })

            db.serialize(()=>{

                const stmt = db.prepare("UPDATE user SET jti = ? WHERE id = ?")
        
                stmt.run(jti, row.id)
        
                stmt.finalize()

                res.cookie('accessToken', token, {
                    httpOnly: true, 
                    sameSite: "lax", 
                    secure: true
                })

               // res.setHeader('Set-Cookie','accessToken=Bearer ' + token + "; HttpOnly;")

                return res.send("Kirjautuminen onnistui")
        
            })

            } else {

                return res.status(400).send()
            }

          })
        }

    )

app.use('/api/v1', router)

app.use(express.static('public'))

app.listen(3000, ()=>{
    console.log("http-palvelin käynnistetty osoitteeseen http://localhost:3000")
})

