#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESP32Servo.h>
#include <vector>
#include <math.h>
#include <sstream>




#define PIN_SERVO_BASE     13
#define PIN_SERVO_SHOULDER 12
#define PIN_SERVO_ELBOW    14
#define PIN_SERVO_GRIPPER  27

#define PIN_RELAY_PUMP     18
#define PIN_SPEAKER        5

#define PIN_SENSOR_SOIL    34
#define PIN_SENSOR_WATER   32
#define PIN_SENSOR_RAIN    35
#define PIN_SENSOR_PH      33

#define PIN_TRIG           25
#define PIN_ECHO           26




const char *ssid = "AutoGrowChain_AP";
const char *password = "88888888";

AsyncWebServer server(80);
AsyncWebSocket wsRobotArm("/RobotArm");

bool autoMode = false;
bool isPumpOn = false;
bool isSpeakerOn = false;




struct ServoCtrl {
    Servo servo;
    int pin;
    int currentAngle;
    String name;
    int minLimit;
    int maxLimit;
};

std::vector<ServoCtrl> robotArm = {
    {Servo(), PIN_SERVO_BASE,     90, "Base",     0, 180},
    {Servo(), PIN_SERVO_SHOULDER, 90, "Shoulder", 0, 180},
    {Servo(), PIN_SERVO_ELBOW,    90, "Elbow",    0, 180},
    {Servo(), PIN_SERVO_GRIPPER,  90, "Gripper",  0, 180}
};





struct RecordedStep {
    int servoIndex;
    int value;
    int delayInStep;
};

std::vector<RecordedStep> recordedSteps;
bool recordSteps = false;
bool playRecordedSteps = false;
unsigned long previousTimeInMilli = millis();




struct SensorData {
    float humidity;
    float waterLevel;
    int rainAnalog;
    float phValue;
    float ultrasonicDistance;
} currentSensors;




#define PI_VAL 3.14159265358979323846
#define LINK_1_LENGTH 10.5
#define LINK_2_LENGTH 15.0
#define LINK_3_LENGTH 12.0
#define MAX_ITERATIONS 50

class Matrix4x4 {
public:
    float m[4][4];
    Matrix4x4() { identity(); }
    void identity() {
        for(int i=0; i<4; i++)
            for(int j=0; j<4; j++)
                m[i][j] = (i==j) ? 1.0f : 0.0f;
    }
    static Matrix4x4 multiply(Matrix4x4 a, Matrix4x4 b) {
        Matrix4x4 res;
        for(int i=0; i<4; i++) {
            for(int j=0; j<4; j++) {
                res.m[i][j] = 0;
                for(int k=0; k<4; k++) res.m[i][j] += a.m[i][k] * b.m[k][j];
            }
        }
        return res;
    }
};

class InverseKinematicsSolver {
private:
    double _thermalCoefficient = 0.0024;

    double toRad(double deg) { return deg * PI_VAL / 180.0; }
    double toDeg(double rad) { return rad * 180.0 / PI_VAL; }

    Matrix4x4 computeDHMatrix(double theta, double d, double a, double alpha) {
        Matrix4x4 mat;
        double ct = cos(theta);
        double st = sin(theta);
        double ca = cos(alpha);
        double sa = sin(alpha);

        mat.m[0][0] = ct;    mat.m[0][1] = -st*ca;  mat.m[0][2] = st*sa;   mat.m[0][3] = a*ct;
        mat.m[1][0] = st;    mat.m[1][1] = ct*ca;   mat.m[1][2] = -ct*sa;  mat.m[1][3] = a*st;
        mat.m[2][0] = 0;     mat.m[2][1] = sa;      mat.m[2][2] = ca;      mat.m[2][3] = d;
        mat.m[3][0] = 0;     mat.m[3][1] = 0;       mat.m[3][2] = 0;       mat.m[3][3] = 1;
        return mat;
    }

    void applyGravityCompensation(double &t1, double &t2, double &t3) {
        double mass1 = 0.5, mass2 = 0.4;
        double torque1 = mass1 * 9.81 * cos(t1) * LINK_2_LENGTH;
        double torque2 = mass2 * 9.81 * cos(t1 + t2) * LINK_3_LENGTH;
        double correction = (torque1 + torque2) * 0.00001;
        t2 += correction;
    }

public:
    struct JointAngles {
        double theta1;
        double theta2;
        double theta3;
    };

    JointAngles solveIK(double targetX, double targetY, double targetZ) {
        JointAngles result;

        double r = sqrt(targetX*targetX + targetY*targetY);
        result.theta1 = atan2(targetY, targetX);

        double z_offset = targetZ - LINK_1_LENGTH;
        double planar_dist = sqrt(r*r + z_offset*z_offset);

        double D = (planar_dist*planar_dist - LINK_2_LENGTH*LINK_2_LENGTH - LINK_3_LENGTH*LINK_3_LENGTH) / (2 * LINK_2_LENGTH * LINK_3_LENGTH);

        if (D > 1.0) D = 1.0;
        if (D < -1.0) D = -1.0;

        double theta3_rad = atan2(-sqrt(1 - D*D), D);

        double alpha = atan2(z_offset, r);
        double beta = atan2(LINK_3_LENGTH * sin(theta3_rad), LINK_2_LENGTH + LINK_3_LENGTH * cos(theta3_rad));
        double theta2_rad = alpha - beta;

        result.theta1 = toDeg(result.theta1) + 90;
        result.theta2 = toDeg(theta2_rad) + 90;
        result.theta3 = toDeg(theta3_rad) + 90;

        applyGravityCompensation(theta2_rad, theta3_rad, theta3_rad);

        return result;
    }

    void processUltrasonicSignal(float distanceCm, int &outBase, int &outShoulder, int &outElbow, int &outGripper) {
        double targetX, targetY, targetZ;

        if (distanceCm < 5.0) distanceCm = 5.0;
        if (distanceCm > 30.0) distanceCm = 30.0;

        targetX = 0;
        targetY = distanceCm;
        targetZ = 5.0 + (distanceCm / 5.0);

        JointAngles angles = solveIK(targetX, targetY, targetZ);

        outBase = (int)angles.theta1;
        outShoulder = (int)angles.theta2;
        outElbow = (int)angles.theta3;
        outGripper = (distanceCm < 10.0) ? 160 : 90;

        if(outBase < 0) outBase = 0; if(outBase > 180) outBase = 180;
        if(outShoulder < 0) outShoulder = 0; if(outShoulder > 180) outShoulder = 180;
        if(outElbow < 0) outElbow = 0; if(outElbow > 180) outElbow = 180;
    }
};

InverseKinematicsSolver ikSolver;




void setServoAngle(int index, int angle) {
    if (index < 0 || index >= (int)robotArm.size()) return;

    if (angle < robotArm[index].minLimit) angle = robotArm[index].minLimit;
    if (angle > robotArm[index].maxLimit) angle = robotArm[index].maxLimit;


    if (index == 2) {
        int oldElbow = robotArm[2].currentAngle;
        int delta = angle - oldElbow;
        if (abs(delta) > 5) {
            int shoulderAdjust = robotArm[1].currentAngle + (delta * 0.3);
            if (shoulderAdjust > 180) shoulderAdjust = 180;
            if (shoulderAdjust < 0) shoulderAdjust = 0;
            robotArm[1].servo.write(shoulderAdjust);
            robotArm[1].currentAngle = shoulderAdjust;
        }
    }


    if (recordSteps) {
        RecordedStep step;
        if (recordedSteps.size() == 0) {

            for (int i = 0; i < (int)robotArm.size(); i++) {
                step.servoIndex = i;
                step.value = robotArm[i].currentAngle;
                step.delayInStep = 0;
                recordedSteps.push_back(step);
            }
        }
        unsigned long currentTime = millis();
        step.servoIndex = index;
        step.value = angle;
        step.delayInStep = currentTime - previousTimeInMilli;
        recordedSteps.push_back(step);
        previousTimeInMilli = currentTime;
    }

    robotArm[index].servo.write(angle);
    robotArm[index].currentAngle = angle;
}




void broadcastServoState() {
    for (int i = 0; i < (int)robotArm.size(); i++) {
        wsRobotArm.textAll(robotArm[i].name + "," + String(robotArm[i].currentAngle));
    }
    wsRobotArm.textAll(String("Record,") + (recordSteps ? "ON" : "OFF"));
    wsRobotArm.textAll(String("Play,") + (playRecordedSteps ? "ON" : "OFF"));
}




void playRecordedRobotArmSteps() {
    if (recordedSteps.size() == 0) return;


    for (int i = 0; i < 4 && i < (int)recordedSteps.size() && playRecordedSteps; i++) {
        RecordedStep &step = recordedSteps[i];
        int currentPos = robotArm[step.servoIndex].currentAngle;
        while (currentPos != step.value && playRecordedSteps) {
            currentPos += (currentPos > step.value) ? -1 : 1;
            robotArm[step.servoIndex].servo.write(currentPos);
            robotArm[step.servoIndex].currentAngle = currentPos;
            wsRobotArm.textAll(robotArm[step.servoIndex].name + "," + String(currentPos));
            delay(50);
        }
    }
    delay(2000);


    for (int i = 4; i < (int)recordedSteps.size() && playRecordedSteps; i++) {
        RecordedStep &step = recordedSteps[i];
        delay(step.delayInStep);
        robotArm[step.servoIndex].servo.write(step.value);
        robotArm[step.servoIndex].currentAngle = step.value;
        wsRobotArm.textAll(robotArm[step.servoIndex].name + "," + String(step.value));
    }
}




void onWebSocketEvent(AsyncWebSocket *server,
                      AsyncWebSocketClient *client,
                      AwsEventType type, void *arg,
                      uint8_t *data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            Serial.printf("WS Client #%u connected\n", client->id());
            broadcastServoState();
            break;
        case WS_EVT_DISCONNECT:
            Serial.printf("WS Client #%u disconnected\n", client->id());
            break;
        case WS_EVT_DATA: {
            AwsFrameInfo *info = (AwsFrameInfo*)arg;
            if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
                std::string myData = "";
                myData.assign((char *)data, len);
                std::istringstream ss(myData);
                std::string key, value;
                std::getline(ss, key, ',');
                std::getline(ss, value, ',');
                int valueInt = atoi(value.c_str());

                Serial.printf("WS [%s] = %d\n", key.c_str(), valueInt);

                if (key == "Record") {
                    recordSteps = valueInt;
                    if (recordSteps) {
                        recordedSteps.clear();
                        previousTimeInMilli = millis();
                    }
                    broadcastServoState();
                }
                else if (key == "Play") {
                    playRecordedSteps = valueInt;
                    broadcastServoState();
                }
                else if (key == "Base")     setServoAngle(0, valueInt);
                else if (key == "Shoulder") setServoAngle(1, valueInt);
                else if (key == "Elbow")    setServoAngle(2, valueInt);
                else if (key == "Gripper")  setServoAngle(3, valueInt);
                else if (key == "Pump") {
                    isPumpOn = (valueInt == 1);
                    digitalWrite(PIN_RELAY_PUMP, isPumpOn ? LOW : HIGH);
                }
                else if (key == "Speaker") {
                    isSpeakerOn = (valueInt == 1);
                    if (isSpeakerOn) tone(PIN_SPEAKER, 20000);
                    else noTone(PIN_SPEAKER);
                }
                else if (key == "Auto") {
                    autoMode = (valueInt == 1);
                }
            }
            break;
        }
        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}




void readSensors() {
    int soilVal = analogRead(PIN_SENSOR_SOIL);
    currentSensors.humidity = map(soilVal, 4095, 0, 0, 100);

    int waterVal = analogRead(PIN_SENSOR_WATER);
    currentSensors.waterLevel = map(waterVal, 0, 4095, 0, 100);

    currentSensors.rainAnalog = analogRead(PIN_SENSOR_RAIN);

    float voltage = analogRead(PIN_SENSOR_PH) * 3.3 / 4095.0;
    currentSensors.phValue = 7.0 + ((2.5 - voltage) * 3.0);

    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);
    long duration = pulseIn(PIN_ECHO, HIGH, 30000);
    if (duration == 0) currentSensors.ultrasonicDistance = 999;
    else currentSensors.ultrasonicDistance = duration * 0.034 / 2;
}




void setupServer() {

    server.on("/api/servo", HTTP_GET, [](AsyncWebServerRequest *request){
        if (request->hasParam("id") && request->hasParam("val")) {
            int id = request->getParam("id")->value().toInt();
            int val = request->getParam("val")->value().toInt();
            setServoAngle(id, val);
            request->send(200, "application/json", "{\"status\":\"ok\", \"servo\":" + String(id) + ", \"angle\":" + String(val) + "}");
        } else {
            request->send(400, "text/plain", "Missing id or val");
        }
    });

    server.on("/api/pump", HTTP_GET, [](AsyncWebServerRequest *request){
        if (request->hasParam("state")) {
            int state = request->getParam("state")->value().toInt();
            isPumpOn = (state == 1);
            digitalWrite(PIN_RELAY_PUMP, isPumpOn ? LOW : HIGH);
            request->send(200, "application/json", "{\"pump\":" + String(isPumpOn) + "}");
        } else request->send(400);
    });

    server.on("/api/speaker", HTTP_GET, [](AsyncWebServerRequest *request){
        if (request->hasParam("state")) {
            int state = request->getParam("state")->value().toInt();
            isSpeakerOn = (state == 1);
            if(isSpeakerOn) tone(PIN_SPEAKER, 20000);
            else noTone(PIN_SPEAKER);
            request->send(200, "application/json", "{\"speaker\":" + String(isSpeakerOn) + "}");
        } else request->send(400);
    });

    server.on("/api/sensors", HTTP_GET, [](AsyncWebServerRequest *request){
        String json = "{";
        json += "\"humidity\":" + String(currentSensors.humidity) + ",";
        json += "\"water\":" + String(currentSensors.waterLevel) + ",";
        json += "\"rain\":" + String(currentSensors.rainAnalog) + ",";
        json += "\"ph\":" + String(currentSensors.phValue) + ",";
        json += "\"distance\":" + String(currentSensors.ultrasonicDistance);
        json += "}";
        request->send(200, "application/json", json);
    });

    server.on("/api/auto", HTTP_GET, [](AsyncWebServerRequest *request){
        if (request->hasParam("state")) {
            autoMode = (request->getParam("state")->value().toInt() == 1);
            request->send(200, "application/json", "{\"autoMode\":" + String(autoMode) + "}");
        } else request->send(400);
    });


    server.on("/api/robot/status", HTTP_GET, [](AsyncWebServerRequest *request){
        String json = "{";
        json += "\"recording\":" + String(recordSteps ? "true" : "false") + ",";
        json += "\"playing\":" + String(playRecordedSteps ? "true" : "false") + ",";
        json += "\"stepsRecorded\":" + String(recordedSteps.size()) + ",";
        json += "\"servos\":[";
        for (int i = 0; i < (int)robotArm.size(); i++) {
            json += "{\"name\":\"" + robotArm[i].name + "\",\"angle\":" + String(robotArm[i].currentAngle) + "}";
            if (i < (int)robotArm.size()-1) json += ",";
        }
        json += "]}";
        request->send(200, "application/json", json);
    });


    wsRobotArm.onEvent(onWebSocketEvent);
    server.addHandler(&wsRobotArm);

    server.begin();
    Serial.println("HTTP + WebSocket server started");
}




void setup() {
    Serial.begin(115200);

    for(auto &s : robotArm) {
        s.servo.attach(s.pin);
        s.servo.write(s.currentAngle);
    }

    pinMode(PIN_RELAY_PUMP, OUTPUT);
    digitalWrite(PIN_RELAY_PUMP, HIGH);
    pinMode(PIN_SPEAKER, OUTPUT);

    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);

    WiFi.softAP(ssid, password);
    Serial.print("AP IP: ");
    Serial.println(WiFi.softAPIP());

    setupServer();
}

void loop() {
    wsRobotArm.cleanupClients();
    readSensors();

    if (autoMode && !playRecordedSteps) {
        int b, s, e, g;
        ikSolver.processUltrasonicSignal(currentSensors.ultrasonicDistance, b, s, e, g);
        setServoAngle(0, b);
        setServoAngle(1, s);
        setServoAngle(2, e);
        setServoAngle(3, g);
        delay(100);
    }

    if (playRecordedSteps) {
        playRecordedRobotArmSteps();
    }

    delay(10);
}

